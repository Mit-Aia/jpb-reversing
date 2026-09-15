import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.util.task.ConsoleTaskMonitor;
import java.io.PrintWriter;
import java.io.FileWriter;
import java.util.*;

public class FindRealParserBodies extends GhidraScript {
    @Override
    public void run() throws Exception {
        String outPath = getScriptArgs()[0];
        PrintWriter out = new PrintWriter(new FileWriter(outPath));

        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);

        String[] needles = { "AGTLinearTrackData", "AGTBezierTrackData", "AGTStepTrackData",
                              "stLinearKey", "stBezierKey", "stStepKey", "AGTrackData" };

        List<Function> candidates = new ArrayList<>();
        out.println("=== non-glue functions matching track-data type names ===");
        for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
            String full = f.getName(true);
            boolean matches = false;
            for (String n : needles) {
                if (full.contains(n)) { matches = true; break; }
            }
            if (!matches) continue;
            if (full.contains("_Base_manager") || full.contains("_Bind") || full.contains("_Mem_fn")
                || full.contains("_Function_base") || full.contains("_Weak_result") || full.contains("_Placeholder")) {
                continue;
            }
            out.println(f.getEntryPoint() + "  " + full + "  size=" + f.getBody().getNumAddresses());
            candidates.add(f);
        }
        out.println("count: " + candidates.size());

        int n = 0;
        for (Function f : candidates) {
            if (n++ >= 15) break;
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
        println("done, wrote " + outPath + " candidates=" + candidates.size());
    }
}
