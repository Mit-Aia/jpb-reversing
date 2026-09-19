import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.lang.Register;
import ghidra.program.model.lang.RegisterValue;
import ghidra.program.model.listing.Function;
import java.io.PrintWriter;
import java.io.FileWriter;
import java.math.BigInteger;

// Lists functions in an address range with their real ARM/Thumb mode (from Ghidra's TMode context
// register at the entry point). Frida needs entry|1 for Thumb and the plain address for ARM; guessing
// wrong corrupts the hooked function (crashed the game with SIGILL on 2026-09-19).
// Output line: <addr> <size> <name> <T|A>
public class ListFuncsMode extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        PrintWriter out = new PrintWriter(new FileWriter(args[0]));
        Address start = currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(args[1]);
        Address end = currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(args[2]);
        Register tmode = currentProgram.getLanguage().getRegister("TMode");
        for (Function f : currentProgram.getFunctionManager().getFunctions(start, true)) {
            if (f.getEntryPoint().compareTo(end) > 0) break;
            RegisterValue rv = currentProgram.getProgramContext().getRegisterValue(tmode, f.getEntryPoint());
            boolean thumb = rv != null && rv.hasValue() && rv.getUnsignedValue().equals(BigInteger.ONE);
            out.println(f.getEntryPoint() + " " + f.getBody().getNumAddresses() + " " + f.getName() + " " + (thumb ? "T" : "A"));
        }
        out.flush();
        out.close();
    }
}
