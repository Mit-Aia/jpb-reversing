import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceManager;
import ghidra.program.model.symbol.ReferenceIterator;
import ghidra.program.model.symbol.Symbol;
import ghidra.program.model.symbol.SymbolTable;
import ghidra.program.model.symbol.SymbolIterator;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.util.task.ConsoleTaskMonitor;
import java.io.PrintWriter;
import java.io.FileWriter;
import java.util.*;

public class FindNeonFuncs extends GhidraScript {
    PrintWriter out;

    @Override
    public void run() throws Exception {
        String outPath = getScriptArgs()[0];
        out = new PrintWriter(new FileWriter(outPath));

        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);

        String[] names = {
            "_transformVertexNeon", "_rotateVertexNeon", "_addVertexNeon",
            "_transformVertex", "_rotateVertex", "_addVertex"
        };

        SymbolTable symTable = currentProgram.getSymbolTable();
        Set<Function> targets = new LinkedHashSet<>();
        Set<Function> callers = new LinkedHashSet<>();

        for (String name : names) {
            SymbolIterator it = symTable.getSymbols(name);
            while (it.hasNext()) {
                Symbol sym = it.next();
                Function f = currentProgram.getFunctionManager().getFunctionAt(sym.getAddress());
                if (f == null) {
                    f = currentProgram.getFunctionManager().getFunctionContaining(sym.getAddress());
                }
                if (f != null) {
                    targets.add(f);
                    out.println("FOUND symbol " + name + " -> function " + f.getName() + " @ " + f.getEntryPoint());
                    // find callers too
                    ReferenceManager refMgr = currentProgram.getReferenceManager();
                    ReferenceIterator refs = refMgr.getReferencesTo(f.getEntryPoint());
                    while (refs.hasNext()) {
                        Reference r = refs.next();
                        Function cf = currentProgram.getFunctionManager().getFunctionContaining(r.getFromAddress());
                        if (cf != null) {
                            callers.add(cf);
                        }
                    }
                } else {
                    out.println("symbol " + name + " found at " + sym.getAddress() + " but no function there");
                }
            }
        }

        out.println("\ntotal target funcs: " + targets.size() + ", callers: " + callers.size());

        List<Function> all = new ArrayList<>();
        all.addAll(targets);
        all.addAll(callers);

        for (Function f : all) {
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
        println("done, wrote " + outPath);
    }
}
