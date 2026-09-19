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

// Given a plain global-variable address (a real fixed address, not a vtable),
// find every function that reads it and decompile them all -- used to find
// who reads the g_profilerZones singleton at 0x0064f598, since whichever
// function reads offset +0x10 ("UP. BONES" zone handle per FUN_0031a1f4) is
// almost certainly the real bone-update entry point we've been hunting.
public class FindGlobalReaders extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = args[0];
        Address target = currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(args[1]);

        PrintWriter out = new PrintWriter(new FileWriter(outPath));
        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);

        ReferenceManager refMgr = currentProgram.getReferenceManager();
        ReferenceIterator refs = refMgr.getReferencesTo(target);
        Set<Function> callers = new LinkedHashSet<>();
        int n = 0;
        while (refs.hasNext()) {
            Reference r = refs.next();
            n++;
            Function cf = currentProgram.getFunctionManager().getFunctionContaining(r.getFromAddress());
            out.println("ref from " + r.getFromAddress() + (cf != null ? " in func " + cf.getName() + "@" + cf.getEntryPoint() : " (no func)") + " type=" + r.getReferenceType());
            if (cf != null) callers.add(cf);
        }
        out.println("total refs: " + n + ", distinct functions: " + callers.size());

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
