const PKG = "/data/data/com.ludia.jurassicpark/";
const res = ptr("0xcb2a57b0");
const f = new File(PKG + "res_big64k.bin", "wb"); f.write(res.readByteArray(0x10000)); f.flush(); f.close();
log("res_big64k dumped");
