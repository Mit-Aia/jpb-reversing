import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.util.task.ConsoleTaskMonitor;
import java.io.PrintWriter;
import java.io.FileWriter;
import java.util.*;

public class FindResourceTrackCtor extends GhidraScript {
    @Override
    public void run() throws Exception {
        String outPath = getScriptArgs()[0];
        PrintWriter out = new PrintWriter(new FileWriter(outPath));

        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);

        // 1) list ALL functions whose qualified name contains AGResourceTrackData, print signatures only
        out.println("=== all functions with AGResourceTrackData in name ===");
        List<Function> candidates = new ArrayList<>();
        for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
            String full = f.getName(true);
            if (full.contains("AGResourceTrackData") && !full.contains("_Base_manager") && !full.contains("_Bind")) {
                out.println(f.getEntryPoint() + "  " + full);
                candidates.add(f);
            }
        }
        out.println("count: " + candidates.size());

        // 2) decompile FUN_00395f4c and FUN_0039eb14 explicitly by address
        String[] addrs = { "00395f4c", "0039eb14" };
        for (String a : addrs) {
            Function f = currentProgram.getFunctionManager().getFunctionAt(
                currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(a));
            if (f == null) {
                out.println("\nno function at " + a);
                continue;
            }
            out.println("\n----- FUNCTION " + f.getName() + " @ " + f.getEntryPoint() + " -----");
            try {
                DecompileResults res = decomp.decompileFunction(f, 60, new ConsoleTaskMonitor());
                if (res != null && res.decompileCompleted()) {
                    out.println(res.getDecompiledFunction().getC());
                } else {
                    out.println("(decompile failed)");
                }
            } catch (Exception e) {
                out.println("(exception: " + e.getMessage() + ")");
            }
        }

        // 3) decompile up to 8 of the AGResourceTrackData candidates found above (constructors likely small)
        int n = 0;
        for (Function f : candidates) {
            if (n++ >= 8) break;
            out.println("\n----- FUNCTION " + f.getName(true) + " @ " + f.getEntryPoint() + " -----");
            try {
                DecompileResults res = decomp.decompileFunction(f, 60, new ConsoleTaskMonitor());
                if (res != null && res.decompileCompleted()) {
                    out.println(res.getDecompiledFunction().getC());
                } else {
                    out.println("(decompile failed)");
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
