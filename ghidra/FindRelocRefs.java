import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.reloc.Relocation;
import ghidra.program.model.reloc.RelocationTable;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceManager;
import ghidra.program.model.symbol.ReferenceIterator;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.util.task.ConsoleTaskMonitor;
import java.io.PrintWriter;
import java.io.FileWriter;
import java.util.*;

// getCallingFunctions() on the EXTERNAL:xxxx pseudo-function for imported GL
// symbols found ZERO callers for even glDrawElements/glUseProgram, which must
// be called for anything to render -- Ghidra's import log showed "no external
// libraries configured - skipping" symbol resolution, so it never built the
// thunk/PLT call graph edges for ANY external symbol. The underlying ELF
// relocation entries are still parsed and available via getRelocationTable()
// though (that's how .data.rel.ro got fixed up correctly earlier this
// session) -- so look up each GL symbol's relocation address directly and
// find code refs to THAT address instead (a GOT-slot load, ordinary DATA ref).
public class FindRelocRefs extends GhidraScript {
    @Override
    public void run() throws Exception {
        String outPath = getScriptArgs()[0];
        PrintWriter out = new PrintWriter(new FileWriter(outPath));
        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);

        Set<String> wanted = new LinkedHashSet<>(Arrays.asList(
            "glUniformMatrix4fv", "glUniformMatrix3fv", "glUniform4fv", "glUniform3fv",
            "glVertexAttribPointer", "glDrawElements", "glDrawArrays", "glUseProgram",
            "glUniform1i", "glGetUniformLocation"
        ));

        RelocationTable relocTable = currentProgram.getRelocationTable();
        Iterator<Relocation> it = relocTable.getRelocations();
        Map<String, List<Address>> hits = new LinkedHashMap<>();
        int total = 0;
        while (it.hasNext()) {
            Relocation r = it.next();
            total++;
            String sym = r.getSymbolName();
            if (sym != null && wanted.contains(sym)) {
                hits.computeIfAbsent(sym, k -> new ArrayList<>()).add(r.getAddress());
            }
        }
        out.println("total relocations in table: " + total);
        out.println("matched symbols: " + hits.size() + " / " + wanted.size());

        Set<Function> callers = new LinkedHashSet<>();
        for (String sym : wanted) {
            List<Address> addrs = hits.get(sym);
            if (addrs == null) {
                out.println("=== " + sym + ": no relocation entry found ===");
                continue;
            }
            for (Address a : addrs) {
                out.println("=== " + sym + " reloc @ " + a + " ===");
                ReferenceManager refMgr = currentProgram.getReferenceManager();
                ReferenceIterator refs = refMgr.getReferencesTo(a);
                int n = 0;
                while (refs.hasNext()) {
                    Reference r = refs.next();
                    n++;
                    Function cf = currentProgram.getFunctionManager().getFunctionContaining(r.getFromAddress());
                    out.println("  ref from " + r.getFromAddress() + (cf != null ? " in func " + cf.getName() + "@" + cf.getEntryPoint() : " (no func)") + " type=" + r.getReferenceType());
                    if (cf != null) callers.add(cf);
                }
                out.println("  total: " + n);
            }
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
