import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import java.io.PrintWriter;
import java.io.FileWriter;
import java.util.*;

public class FindTrackDataFuncs extends GhidraScript {
    @Override
    public void run() throws Exception {
        String outPath = getScriptArgs()[0];
        PrintWriter out = new PrintWriter(new FileWriter(outPath));

        String[] needles = { "TrackData", "AGVec3", "AGQuat", "stUVKey", "AGTAnimatedData", "AGAnimatedResource" };

        int count = 0;
        for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
            String full = f.getName(true); // includes namespace path
            for (String n : needles) {
                if (full.contains(n)) {
                    out.println(f.getEntryPoint() + "  " + full + "  " + f.getSignature().getPrototypeString());
                    count++;
                    break;
                }
            }
        }
        out.println("\ntotal matches: " + count);
        out.flush();
        out.close();
        println("done: " + count);
    }
}
