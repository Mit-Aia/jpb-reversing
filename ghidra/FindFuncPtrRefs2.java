import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSet;
import ghidra.program.model.mem.Memory;
import ghidra.program.model.mem.MemoryBlock;
import ghidra.program.model.listing.Function;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceManager;
import ghidra.program.model.symbol.ReferenceIterator;
import java.io.PrintWriter;
import java.io.FileWriter;
import java.util.*;

// Scans every readable memory block for raw little-endian 4-byte occurrences of
// given target addresses (both plain and thumb-bit-set variants), since virtual
// function tables reference code addresses as plain data words, not as normal
// instruction xrefs (which is why FindNeonFuncs-style xref search finds 0 refs
// for functions only ever called through a vtable slot).
public class FindFuncPtrRefs2 extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = args[0];
        List<Long> targets = new ArrayList<>();
        for (int i = 1; i < args.length; i++) {
            targets.add(Long.parseLong(args[i], 16));
        }

        PrintWriter out = new PrintWriter(new FileWriter(outPath));
        Memory mem = currentProgram.getMemory();

        for (long t : targets) {
            long thumb = t | 1L;
            out.println("=== target 0x" + Long.toHexString(t) + " (plain) / 0x" + Long.toHexString(thumb) + " (thumb) ===");
            int hits = 0;
            for (MemoryBlock block : mem.getBlocks()) {
                if (!block.isInitialized() || !block.isRead()) continue;
                Address start = block.getStart();
                Address end = block.getEnd();
                long size = block.getSize();
                if (size > 200_000_000) continue; // safety
                byte[] buf;
                try {
                    buf = new byte[(int) size];
                    block.getBytes(start, buf);
                } catch (Exception e) {
                    out.println("  (failed to read block " + block.getName() + ": " + e.getMessage() + ")");
                    continue;
                }
                for (int i = 0; i + 4 <= buf.length; i += 4) {
                    long val = (buf[i] & 0xFFL) | ((buf[i+1] & 0xFFL) << 8) | ((buf[i+2] & 0xFFL) << 16) | ((buf[i+3] & 0xFFL) << 24);
                    if (val == t || val == thumb) {
                        Address hitAddr = start.add(i);
                        out.println("  hit in block=" + block.getName() + " at " + hitAddr + " value=0x" + Long.toHexString(val));
                        hits++;
                    }
                }
            }
            out.println("  total hits: " + hits);
        }

        out.flush();
        out.close();
        println("done");
    }
}
