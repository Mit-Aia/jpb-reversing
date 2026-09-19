import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceManager;
import ghidra.program.model.symbol.ReferenceIterator;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.util.task.ConsoleTaskMonitor;
import java.io.PrintWriter;
import java.io.FileWriter;
import java.util.*;

// Plain "find callers of these addresses (as functions) and decompile them" --
// for ordinary (non-virtual) direct-call functions like constructors, which DO
// show up as normal call xrefs.
public class FindCallersDecompile extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = args[0];
        PrintWriter out = new PrintWriter(new FileWriter(outPath));
        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);

        Set<Function> toDecompile = new LinkedHashSet<>();

        for (int i = 1; i < args.length; i++) {
            Address a = currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(args[i]);
            Function target = currentProgram.getFunctionManager().getFunctionAt(a);
            String tname = target != null ? target.getName() : "?";
            out.println("=== callers of " + tname + " @ " + a + " ===");
            ReferenceManager refMgr = currentProgram.getReferenceManager();
            ReferenceIterator refs = refMgr.getReferencesTo(a);
            int n = 0;
            while (refs.hasNext()) {
                Reference r = refs.next();
                n++;
                Function cf = currentProgram.getFunctionManager().getFunctionContaining(r.getFromAddress());
                out.println("  ref from " + r.getFromAddress() + (cf != null ? " in func " + cf.getName() + "@" + cf.getEntryPoint() : " (no func)") + " type=" + r.getReferenceType());
                if (cf != null) toDecompile.add(cf);
            }
            out.println("  total: " + n);
        }

        for (Function f : toDecompile) {
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
