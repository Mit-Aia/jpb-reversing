import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.mem.Memory;
import ghidra.program.model.mem.MemoryBlock;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceManager;
import ghidra.program.model.symbol.ReferenceIterator;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.util.task.ConsoleTaskMonitor;
import java.io.PrintWriter;
import java.io.FileWriter;
import java.nio.charset.StandardCharsets;
import java.util.*;

// Profiler/debug label strings ("UP. BONES", "THREADED SKINNING - MAIN", etc,
// found via strings.txt from an earlier session) are a much more direct route
// to the real bone-update code than class-name/vtable archaeology: engines
// tag perf-profiling zones with these labels right at the call site of the
// zone they measure, so an xref leads almost straight to the real function.
// Args: outPath, then each subsequent arg is one string to search for
// (spaces allowed since these come as separate argv entries already split by
// the launcher -- pass each string as its own quoted script arg).
public class FindStringXrefs extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = args[0];
        PrintWriter out = new PrintWriter(new FileWriter(outPath));
        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);
        Memory mem = currentProgram.getMemory();

        Set<Function> callers = new LinkedHashSet<>();

        for (int i = 1; i < args.length; i++) {
            String needle = args[i];
            byte[] needleBytes = needle.getBytes(StandardCharsets.US_ASCII);
            out.println("=== searching for string: \"" + needle + "\" (" + needleBytes.length + " bytes) ===");
            List<Address> stringAddrs = new ArrayList<>();

            for (MemoryBlock block : mem.getBlocks()) {
                if (!block.isInitialized() || !block.isRead()) continue;
                long size = block.getSize();
                if (size > 200_000_000) continue;
                byte[] buf;
                try {
                    buf = new byte[(int) size];
                    block.getBytes(block.getStart(), buf);
                } catch (Exception e) {
                    continue;
                }
                outer:
                for (int p = 0; p + needleBytes.length <= buf.length; p++) {
                    for (int k = 0; k < needleBytes.length; k++) {
                        if (buf[p + k] != needleBytes[k]) continue outer;
                    }
                    Address a = block.getStart().add(p);
                    stringAddrs.add(a);
                    out.println("  found at " + a + " in block " + block.getName());
                }
            }

            for (Address sa : stringAddrs) {
                ReferenceManager refMgr = currentProgram.getReferenceManager();
                ReferenceIterator refs = refMgr.getReferencesTo(sa);
                int n = 0;
                while (refs.hasNext()) {
                    Reference r = refs.next();
                    n++;
                    Function cf = currentProgram.getFunctionManager().getFunctionContaining(r.getFromAddress());
                    out.println("    ref from " + r.getFromAddress() + (cf != null ? " in func " + cf.getName() + "@" + cf.getEntryPoint() : " (no func)") + " type=" + r.getReferenceType());
                    if (cf != null) callers.add(cf);
                }
                out.println("    (xrefs to " + sa + "): " + n);
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
