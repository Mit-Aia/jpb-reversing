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

// vtable slot0 addresses store into `this` by constructors -- unlike the
// virtual-call targets themselves (0 xrefs, called indirectly), a constructor
// loading "this->vtable_ptr = &vtable[0]" is a normal data/code reference
// Ghidra's own analyzer tracks. Find + decompile whoever references these.
public class FindVtableCtors extends GhidraScript {
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
            out.println("=== refs to vtable-slot0 @ " + a + " ===");
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
