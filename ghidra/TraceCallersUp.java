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

// Walks UP the call graph from a set of seed addresses, N levels, decompiling
// every newly-discovered caller. Goal: find the loop/registry that owns the
// per-instance objects passed into FUN_0047b8b4 / FUN_0047c380 (the bone-matrix
// update wrappers), to locate the scene-node array without ever hooking code.
public class TraceCallersUp extends GhidraScript {
    PrintWriter out;
    DecompInterface decomp;

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = args[0];
        int depth = Integer.parseInt(args[1]);
        List<String> seeds = new ArrayList<>();
        for (int i = 2; i < args.length; i++) seeds.add(args[i]);

        out = new PrintWriter(new FileWriter(outPath));
        decomp = new DecompInterface();
        decomp.openProgram(currentProgram);

        Set<Function> visited = new LinkedHashSet<>();
        List<Function> frontier = new ArrayList<>();

        for (String s : seeds) {
            Address a = currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(s);
            Function f = currentProgram.getFunctionManager().getFunctionAt(a);
            if (f == null) f = currentProgram.getFunctionManager().getFunctionContaining(a);
            if (f != null) frontier.add(f);
            else out.println("seed not found: " + s);
        }

        for (int level = 0; level <= depth && !frontier.isEmpty(); level++) {
            out.println("\n========== LEVEL " + level + " (" + frontier.size() + " funcs) ==========");
            List<Function> nextFrontier = new ArrayList<>();
            for (Function f : frontier) {
                if (visited.contains(f)) continue;
                visited.add(f);

                out.println("\n----- FUNCTION " + f.getName() + " @ " + f.getEntryPoint() + " -----");
                ReferenceManager refMgr = currentProgram.getReferenceManager();
                ReferenceIterator refs = refMgr.getReferencesTo(f.getEntryPoint());
                List<Function> callers = new ArrayList<>();
                int refCount = 0;
                while (refs.hasNext()) {
                    Reference r = refs.next();
                    refCount++;
                    Function cf = currentProgram.getFunctionManager().getFunctionContaining(r.getFromAddress());
                    out.println("  ref from " + r.getFromAddress() + (cf != null ? " in func " + cf.getName() + "@" + cf.getEntryPoint() : " (no containing func)") + " type=" + r.getReferenceType());
                    if (cf != null && !visited.contains(cf)) {
                        callers.add(cf);
                    }
                }
                out.println("  total refs: " + refCount);

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

                for (Function cf : callers) {
                    if (!nextFrontier.contains(cf)) nextFrontier.add(cf);
                }
            }
            frontier = nextFrontier;
        }

        out.flush();
        out.close();
        println("done");
    }
}
