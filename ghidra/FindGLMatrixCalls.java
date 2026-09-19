import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceManager;
import ghidra.program.model.symbol.ReferenceIterator;
import ghidra.program.model.symbol.Symbol;
import ghidra.program.model.symbol.SymbolIterator;
import ghidra.program.model.symbol.SymbolTable;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.util.task.ConsoleTaskMonitor;
import java.io.PrintWriter;
import java.io.FileWriter;
import java.util.*;

// If the CPU-skinning path (VertexBufferDynamicImpl, see project_mesh_format_re
// memory) is never instantiated at runtime on a given device (confirmed absent
// via a heap-scan-by-vtable-signature this session), the engine likely uses a
// GPU-skinning path instead: bone matrices uploaded once per frame via a GL
// uniform call (glUniformMatrix4fv or similar), then the vertex shader itself
// does the per-vertex transform. GL entry points are plain imported symbols
// with normal, unambiguous call xrefs -- unlike the C++ virtual methods that
// dead-ended earlier this session, so this should be much easier to trace.
public class FindGLMatrixCalls extends GhidraScript {
    @Override
    public void run() throws Exception {
        String outPath = getScriptArgs()[0];
        PrintWriter out = new PrintWriter(new FileWriter(outPath));
        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);

        String[] names = {
            "glUniformMatrix4fv", "glUniformMatrix3fv", "glUniformMatrix2fv",
            "glUniform4fv", "glUniform3fv", "glUniformMatrix4x3fv",
            "glVertexAttribPointer", "glDrawElements", "glDrawArrays",
            "glUseProgram", "glUniform1i", "glGetUniformLocation"
        };

        SymbolTable symTable = currentProgram.getSymbolTable();
        Set<Function> callers = new LinkedHashSet<>();

        ConsoleTaskMonitor monitor = new ConsoleTaskMonitor();
        for (String name : names) {
            SymbolIterator it = symTable.getSymbols(name);
            boolean found = false;
            while (it.hasNext()) {
                Symbol sym = it.next();
                found = true;
                Function target = currentProgram.getFunctionManager().getFunctionAt(sym.getAddress());
                out.println("=== symbol " + name + " @ " + sym.getAddress() + " (type=" + sym.getSymbolType() + ", func=" + target + ") ===");
                if (target == null) {
                    out.println("  (no Function object here, skipping)");
                    continue;
                }
                // getCallingFunctions() resolves through thunk stubs correctly,
                // unlike a raw getReferencesTo(externalAddr) which finds 0 refs
                // because real call sites target a local thunk in .text, not
                // the pseudo EXTERNAL: address itself.
                Set<Function> thisCallers = target.getCallingFunctions(monitor);
                out.println("  total callers: " + thisCallers.size());
                for (Function cf : thisCallers) {
                    out.println("  called from " + cf.getName() + "@" + cf.getEntryPoint());
                    if (name.startsWith("glUniformMatrix")) callers.add(cf);
                }
            }
            if (!found) out.println("=== symbol " + name + " NOT FOUND (not imported / not used) ===");
        }

        for (Function f : callers) {
            out.println("\n----- FUNCTION " + f.getName() + " @ " + f.getEntryPoint() + " -----");
            try {
                DecompileResults res = decomp.decompileFunction(f, 60, new ConsoleTaskMonitor());
                if (res != null && res.decompileCompleted()) {
                    out.println(res.getDecompiledFunction().getC());
                } else {
                    out.println("(decompile failed: " + (res != null ? res.getErrorMessage() : "null") + ")");
                }
            } catch (Exception e) {
                out.println("(exception: " + e.getMessage() + ")");
            }
        }

        out.flush();
        out.close();
        println("done");
    }
}
