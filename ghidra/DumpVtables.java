import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.Data;
import ghidra.program.model.mem.Memory;
import ghidra.program.model.symbol.Symbol;
import ghidra.program.model.symbol.SymbolTable;
import java.io.PrintWriter;
import java.io.FileWriter;
import java.util.*;

// Given known vtable-slot addresses (found via raw-pointer scan), dump a wide
// window of surrounding words, resolving each as: a function (name+addr) if it
// points into a defined function, a string if it points at ASCII data, or a
// plain address/int otherwise. Goal: identify the typeinfo pointer (Itanium
// ABI: vtable[-2] from the first virtual slot) to recover a real class name,
// and see the full method list to figure out which slot this "update" method is.
public class DumpVtables extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = args[0];
        List<Long> centers = new ArrayList<>();
        for (int i = 1; i < args.length; i++) centers.add(Long.parseLong(args[i], 16));

        PrintWriter out = new PrintWriter(new FileWriter(outPath));
        Memory mem = currentProgram.getMemory();
        var addrFactory = currentProgram.getAddressFactory().getDefaultAddressSpace();
        var funcMgr = currentProgram.getFunctionManager();
        SymbolTable symTable = currentProgram.getSymbolTable();

        for (long c : centers) {
            out.println("\n===== window around 0x" + Long.toHexString(c) + " =====");
            long startOff = c - 0x40;
            for (long off = startOff; off <= c + 0x40; off += 4) {
                Address a = addrFactory.getAddress(off);
                try {
                    long val = mem.getInt(a) & 0xFFFFFFFFL;
                    StringBuilder sb = new StringBuilder();
                    sb.append(a).append(" : 0x").append(String.format("%08x", val));
                    long codeAddr = val & ~1L;
                    Address target = addrFactory.getAddress(codeAddr);
                    Function f = funcMgr.getFunctionContaining(target);
                    if (f != null) {
                        sb.append("  -> FUNC ").append(f.getName()).append(" @ ").append(f.getEntryPoint());
                    } else {
                        Data d = getDataAt(target);
                        if (d != null && d.hasStringValue()) {
                            sb.append("  -> STRING \"").append(d.getValue()).append("\"");
                        }
                        Symbol[] syms = symTable.getSymbols(target);
                        if (syms.length > 0) {
                            sb.append("  -> SYM ").append(syms[0].getName());
                        }
                        // try reading a few bytes as ascii in case it's an unlabeled string
                        try {
                            byte[] peek = new byte[24];
                            mem.getBytes(target, peek);
                            boolean printable = true;
                            int len = 0;
                            for (byte b : peek) {
                                if (b == 0) break;
                                if (b < 0x20 || b > 0x7e) { printable = false; break; }
                                len++;
                            }
                            if (printable && len >= 3) {
                                sb.append("  -> ascii-ish \"").append(new String(peek, 0, len)).append("\"");
                            }
                        } catch (Exception e) {}
                    }
                    if (off == c) sb.append("   <=== HIT");
                    out.println(sb.toString());
                } catch (Exception e) {
                    out.println(a + " : (unreadable: " + e.getMessage() + ")");
                }
            }
        }

        out.flush();
        out.close();
        println("done");
    }
}
