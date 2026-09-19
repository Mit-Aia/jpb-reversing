import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.InstructionIterator;
import ghidra.program.model.symbol.Reference;
import java.io.PrintWriter;
import java.io.FileWriter;

// Lists N instructions starting at a given address with EVERY resolved
// reference (of any type) each instruction makes -- used to recover the real,
// concrete address of a PIC "DAT_xxx + immediate" global-pointer expression
// the decompiler shows symbolically: the underlying STR instruction's own
// resolved data reference gives the actual fixed address directly.
public class ListInstrRefs extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        String outPath = args[0];
        Address start = currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(args[1]);
        int count = Integer.parseInt(args[2]);

        PrintWriter out = new PrintWriter(new FileWriter(outPath));
        InstructionIterator it = currentProgram.getListing().getInstructions(start, true);
        int n = 0;
        while (it.hasNext() && n < count) {
            Instruction ins = it.next();
            out.println(ins.getAddress() + ": " + ins);
            for (Reference r : ins.getReferencesFrom()) {
                out.println("    -> " + r.getToAddress() + " type=" + r.getReferenceType());
            }
            n++;
        }
        out.flush();
        out.close();
        println("done");
    }
}
