import ghidra.app.script.GhidraScript;
import ghidra.program.model.symbol.Symbol;
import ghidra.program.model.symbol.SymbolTable;
import ghidra.program.model.symbol.SymbolIterator;
import java.io.PrintWriter;
import java.io.FileWriter;

public class ListRttiSymbols extends GhidraScript {
    @Override
    public void run() throws Exception {
        String outPath = getScriptArgs()[0];
        PrintWriter out = new PrintWriter(new FileWriter(outPath));
        SymbolTable st = currentProgram.getSymbolTable();
        SymbolIterator all = st.getAllSymbols(true);
        int count = 0;
        while (all.hasNext()) {
            Symbol s = all.next();
            String n = s.getName();
            String ln = n.toLowerCase();
            if (ln.contains("vtable") || n.contains("_ZTV") || n.contains("_ZTI") || n.contains("_ZTS")
                || ln.contains("agskin") || ln.contains("agmesh") || ln.contains("typeinfo")) {
                out.println(s.getSymbolType() + "  " + s.getAddress() + "  " + n);
                count++;
            }
        }
        out.println("\ntotal matches: " + count);
        out.flush();
        out.close();
        println("done: " + count + " matches");
    }
}
