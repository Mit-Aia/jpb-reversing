import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSet;
import java.io.PrintWriter;
import java.io.FileWriter;

public class ListFuncsNear extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = args[0];
        Address start = currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(args[1]);
        Address end = currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(args[2]);

        PrintWriter out = new PrintWriter(new FileWriter(outPath));
        int count = 0;
        for (Function f : currentProgram.getFunctionManager().getFunctions(start, true)) {
            if (f.getEntryPoint().compareTo(end) > 0) break;
            out.println(f.getEntryPoint() + "  size=" + f.getBody().getNumAddresses() + "  " + f.getName() + "  " + f.getSignature().getPrototypeString());
            count++;
        }
        out.println("\ntotal: " + count);
        out.flush();
        out.close();
        println("done: " + count);
    }
}
