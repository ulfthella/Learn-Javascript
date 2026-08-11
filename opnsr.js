const { default:  TelegramBot } = require('node-telegram-bot-api');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const creds = require('./service_account.json');

// ========================================================
// 1. KONFIGURASI RAW (KHUSUS DEV/DEBUG - JANGAN DI-COMMIT!)
// ========================================================
const BOT_TOKEN = "8756939488:AAG7Hjzjl5HmqtppfyZDHvOHIP2Ca0NGapc";
const ID_SPREADSHEET = "1LAdwMt8m7axmw2VAb_czESBrwqHide42Kp45gxysB40";
const USER_DI_IZINKAN = [7771158250,1610870890]; // Ganti dengan Telegram user_id admin (angka)

// ========================================================
// 2. SETUP GOOGLE SHEETS & BOT
// ========================================================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
bot.on('polling_error', (error) => {
    console.error('Polling Error:', error.message);
});

bot.getMe().then((me) => {
    console.log(`Terhubung ke Telegram sebagai @${me.username}`);
});

const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive',
    ],
});

const doc = new GoogleSpreadsheet(ID_SPREADSHEET, serviceAccountAuth);
let sheetMaster, sheetLog;

async function initGoogleSheets() {
    try {
        await doc.loadInfo();
        sheetMaster = doc.sheetsByTitle["Sheet1"];
        sheetLog = doc.sheetsByTitle["Sheet3"];
        console.log("✅ Terhubung ke Google Sheets Berhasil!");
    } catch (error) {
        console.error("❌ Gagal terhubung ke Google Sheets:", error);
    }
}
initGoogleSheets();

const userState = {};

// --- FUNGSI KEAMANAN & CHECK HAK AKSES ---
function punyaAkses(msg) {
    const userId = msg.from.id;
    if (USER_DI_IZINKAN.includes(userId)) {
        return true;
    }
    bot.sendMessage(
        msg.chat.id,
        `❌ **AKSES DITOLAK!**\nID Anda (\`${userId}\`) tidak terdaftar sebagai admin kasir.`,
        { parse_mode: 'Markdown' }
    );
    return false;
}

// --- FUNGSI PEMBANTU ---
async function ambilDataSheets() {
    try {
        await sheetMaster.loadHeaderRow();
        const rows = await sheetMaster.getRows();
        const cleanedRecords = rows.map(row => {
            return {
                "Nama Barang": String(row.get("Nama Barang") || "").trim(),
                "Stok": Number(row.get("Stok") || 0),
                "Waktu Update": String(row.get("Waktu Update") || ""),
                "Threshold": Number(row.get("Threshold") || 0)
            };
        });
        return cleanedRecords;
    } catch (e) {
        console.error(`Error ambil data master: ${e}`);
        return [];
    }
}

async function cariBarisMaster(namaBarang) {
    try {
        const rows = await sheetMaster.getRows();
        for (let i = 0; i < rows.length; i++) {
            const val = String(rows[i].get("Nama Barang") || "").trim();
            if (val.toLowerCase() === String(namaBarang).toLowerCase()) {
                return i; // Index array baris (tambahkan 2 jika ingin baris Excel asli karena header)
            }
        }
        return -1;
    } catch (e) {
        return -1;
    }
}

function cekCancel(msg) {
    if (msg.text && msg.text.trim().toLowerCase() === '/cancel') {
        const chatId = msg.chat.id;
        delete userState[chatId];
        bot.sendMessage(chatId, "🚫 **AKSI DIBATALKAN.** Kembali ke menu utama.", {
            reply_markup: menuUtama()
        });
        return true;
    }
    return false;
}

function menuUtama() {
    return {
        reply_markup: {
            keyboard: [
                [{ text: "➕ Tambah Stok" }, { text: "➖ Kurangi Stok" }],
                [{ text: "📊 Cek Stok" }]
            ],
            resize_keyboard: true
        }
    };
}

// ========================================================
// 3. HANDLER UTAMA BOT TELEGRAM
// ========================================================

bot.onText(/\/start|\/help/, async (msg) => {
    if (!punyaAkses(msg)) return;
    const chatId = msg.chat.id;
    delete userState[chatId];

    const pesanMenu = (
        "👋 <b>Bot Kasir Live Master Terintegrasi (JS)!</b>\n\n" +
        "Tombol Bawah: Manipulasi data real-time di Sheet1.\n\n" +
        "<b>Command Admin Ekstra (Log ke Sheet3):</b>\n" +
        "📦 /tambah_produk - Masukkan barang baru ke Sheet1\n" +
        "✏️ /edit_produk - Ganti nama produk di Sheet1\n" +
        "🎯 /set_stok - Overwrite paksa stok di Sheet1\n" +
        "⚙️ /set_threshold - Atur batas limit Sheet1\n" +
        "🗑️ /hapus_produk - Hapus produk dari Sheet1\n" +
        "💥 /clear_produk - Wipe out total dari Sheet1 & Sheet3\n" +
        "❌ /cancel - Batalkan langkah berjalan"
    );
    bot.sendMessage(chatId, pesanMenu, { parse_mode: 'HTML', ...menuUtama() });
});

bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    if (!punyaAkses(msg)) return;

    const chatId = msg.chat.id;
    const text = msg.text

    if (["➕ Tambah Stok", "➖ Kurangi Stok", "📊 Cek Stok"].includes(text)) {

    // =========================
    // CEK STOK
    // =========================
    if (text === "📊 Cek Stok") {

        let records;

        try {
            records = await ambilDataSheets();
        } catch (error) {
            console.error("Error ambilDataSheets:", error);

            await bot.sendMessage(
                chatId,
                "❌ Gagal mengambil data dari Google Sheets."
            );

            return;
        }

        if (!records || records.length === 0) {
            await bot.sendMessage(
                chatId,
                "❌ Sheet1 kosong atau data tidak ditemukan."
            );

            return;
        }

        let pesan = "📊 *DAFTAR STOK REAL-TIME (SHEET1)*\n\n";

        for (const row of records) {
            const namaBarang = row["Nama Barang"] ?? "-";
            const stok = row["Stok"] ?? "0";

            pesan += `• *${namaBarang}*: ${stok} pcs\n`;
        }

        await bot.sendMessage(chatId, pesan, {
            parse_mode: "Markdown"
        });

        return;
    }

    // =========================
    // TAMBAH / KURANG STOK
    // =========================

    let records;

    try {
        records = await ambilDataSheets();
    } catch (error) {
        console.error("Error ambilDataSheets:", error);

        await bot.sendMessage(
            chatId,
            "❌ Gagal mengambil data dari Google Sheets."
        );

        return;
    }

    if (!records || records.length === 0) {
        await bot.sendMessage(
            chatId,
            "❌ Sheet1 kosong atau data tidak ditemukan."
        );

        return;
    }

    const aksi = text.includes("➕") ? "tambah" : "kurang";

    userState[chatId] = {
        aksi: aksi
    };

    const inlineKeyboard = records
        .filter(row => row["Nama Barang"])
        .map((row, index) => [
            {
                text: row["Nama Barang"],
                callback_data: `harian:${index}`
            }
        ]);

    if (inlineKeyboard.length === 0) {
        await bot.sendMessage(
            chatId,
            "❌ Tidak ada produk yang valid di Sheet1."
        );

        return;
    }

    await bot.sendMessage(
        chatId,
        `Pilih produk yang ingin di-${aksi} di Sheet1:`,
        {
            reply_markup: {
                inline_keyboard: inlineKeyboard
            }
        }
    );

    return;
}

    // Penanganan State Step-by-Step Berjalan
    if (userState[chatId]) {
        if (cekCancel(msg)) return;
        const state = userState[chatId];

        if (state.step === 'PROSES_NAMA_BARU') {
            const namaBarang = text.trim();
            const records = await ambilDataSheets();
            const exists = records.some(r => r["Nama Barang"].toLowerCase() === namaBarang.toLowerCase());
            
            if (exists) {
                bot.sendMessage(chatId, `❌ **Gagal!** Produk *${namaBarang}* sudah ada di Sheet1 Master.`, { parse_mode: 'Markdown', ...menuUtama() });
                delete userState[chatId];
                return;
            }
            userState[chatId].nama_baru = namaBarang;
            userState[chatId].step = 'PROSES_STOK_BARU';
            bot.sendMessage(chatId, `🔢 Masukkan jumlah **STOK AWAL** untuk *${namaBarang}*:`, { parse_mode: 'Markdown' });
        } 
        else if (state.step === 'PROSES_STOK_BARU') {
            if (isNaN(text.trim())) {
                bot.sendMessage(chatId, "❌ Input harus angka bulat! Masukkan ulang:");
                return;
            }
            userState[chatId].stok_baru = parseInt(text.trim());
            userState[chatId].step = 'PROSES_THRESHOLD_BARU';
            bot.sendMessage(chatId, `⚠️ Masukkan **LIMIT THRESHOLD** (Stok Minimum) di Sheet1:`, { parse_mode: 'Markdown' });
        }
        else if (state.step === 'PROSES_THRESHOLD_BARU') {
            if (isNaN(text.trim())) {
                bot.sendMessage(chatId, "❌ Input threshold harus angka! Masukkan ulang:");
                return;
            }
            userState[chatId].threshold = parseInt(text.trim());
            userState[chatId].step = 'PROSES_PRODUK_BARU_FINAL';
            bot.sendMessage(chatId, `📝 Masukkan **KETERANGAN / ALASAN** pendaftaran produk baru ini:`, { parse_mode: 'Markdown' });
        }
        else if (state.step === 'PROSES_PRODUK_BARU_FINAL') {
            const keterangan = text.trim();
            try {
                const waktuSekarang = new Date().toISOString().slice(0, 19).replace('T', ' ');
                await sheetMaster.addRow([state.nama_baru, state.stok_baru, waktuSekarang, state.threshold]);
                
                const waktuLog = new Date().toLocaleString('id-ID');
                await sheetLog.addRow([waktuLog, state.nama_baru, state.aksi, state.stok_baru, keterangan]);

                bot.sendMessage(chatId, `✅ **Produk Berhasil Terdaftar!**\n\nSheet1 ter-update, log keterangan tersimpan aman di Sheet3.`, menuUtama());
            } catch (e) {
                bot.sendMessage(chatId, `❌ Gagal input data: ${e.message}`, menuUtama());
            }
            delete userState[chatId];
        }
        else if (state.step === 'EDIT_NAMA_BARU') {
            const namaBaru = text.trim();
            userState[chatId].nama_baru = namaBaru;
            userState[chatId].step = 'EDIT_NAMA_FINAL';
            bot.sendMessage(chatId, `📝 Masukkan **ALASAN** perubahan nama produk dari *${state.barang}* menjadi *${namaBaru}*:`, { parse_mode: 'Markdown' });
        }
        else if (state.step === 'EDIT_NAMA_FINAL') {
            const keterangan = text.trim();
            try {
                const rows = await sheetMaster.getRows();
                const rowIndex = await cariBarisMaster(state.barang);
                if (rowIndex !== -1) {
                    rows[rowIndex].set("Nama Barang", state.nama_baru);
                    rows[rowIndex].set("Waktu Update", new Date().toISOString().slice(0, 19).replace('T', ' '));
                    await rows[rowIndex].save();
                }
                const waktuLog = new Date().toLocaleString('id-ID');
                await sheetLog.addRow([waktuLog, `${state.barang} -> ${state.nama_baru}`, "EDIT NAMA", 0, keterangan]);

                bot.sendMessage(chatId, `✅ **Nama Produk Berhasil Diubah di Sheet1!**`, menuUtama());
            } catch (e) {
                bot.sendMessage(chatId, `❌ Gagal edit nama: ${e.message}`, menuUtama());
            }
            delete userState[chatId];
        }
        else if (state.step === 'CLEAR_TOTAL') {
            const targetBarang = text.trim().toLowerCase();
            bot.sendMessage(chatId, "⏳ Membersihkan database paralel...");
            try {
                const rowsMaster = await sheetMaster.getRows();
                let deletedMaster = false;
                for (let i = rowsMaster.length - 1; i >= 0; i--) {
                    if (String(rowsMaster[i].get("Nama Barang")).trim().toLowerCase() === targetBarang) {
                        await rowsMaster[i].delete();
                        deletedMaster = true;
                    }
                }

                const rowsLog = await sheetLog.getRows();
                let barisLogDihapus = 0;
                for (let i = rowsLog.length - 1; i >= 0; i--) {
                    if (String(rowsLog[i].get("Nama Barang") || "").toLowerCase().includes(targetBarang)) {
                        await rowsLog[i].delete();
                        barisLogDihapus++;
                    }
                }
                bot.sendMessage(chatId, `🔥 **Wipe Out Selesai!**\nMaster Terhapus: ${deletedMaster}\nLog Terhapus di Sheet3: ${barisLogDihapus} baris.`, menuUtama());
            } catch (e) {
                bot.sendMessage(chatId, `❌ Gagal wiping data: ${e.message}`, menuUtama());
            }
            delete userState[chatId];
        }
        else if (state.step === 'MINTA_KETERANGAN_TRANSAKSI') {
            if (isNaN(text.trim())) {
                bot.sendMessage(chatId, "❌ Input wajib berupa angka! Silakan masukkan ulang:");
                return;
            }
            userState[chatId].jumlah_input = parseInt(text.trim());
            userState[chatId].step = 'EKSEKUSI_TRANSAKSI_FINAL';
            bot.sendMessage(chatId, `📝 Masukkan **KETERANGAN / ALASAN** perubahan transaksi ini:`, { parse_mode: 'Markdown' });
        }
        else if (state.step === 'EKSEKUSI_TRANSAKSI_FINAL') {
            const keterangan = text.trim();
            const namaBarang = state.barang;
            const aksi = state.aksi;
            const jumlah = state.jumlah_input;

            try {
                const rows = await sheetMaster.getRows();
                const rowIndex = await cariBarisMaster(namaBarang);

                if (rowIndex === -1 && aksi !== "HAPUS PRODUK") {
                    bot.sendMessage(chatId, "❌ ERROR: Produk tidak ditemukan di Sheet1 Master.", menuUtama());
                    delete userState[chatId];
                    return;
                }

                const waktuSekarang = new Date().toISOString().slice(0, 19).replace('T', ' ');
                let stokTerkini = 0;
                const rowObj = rows[rowIndex];

                if (aksi === "SET STOK AWAL") {
                    stokTerkini = jumlah;
                    rowObj.set("Stok", stokTerkini);
                    rowObj.set("Waktu Update", waktuSekarang);
                    await rowObj.save();
                } else if (aksi === "SET THRESHOLD") {
                    rowObj.set("Threshold", jumlah);
                    rowObj.set("Waktu Update", waktuSekarang);
                    await rowObj.save();
                    stokTerkini = Number(rowObj.get("Stok") || 0);
                } else if (aksi === "HAPUS PRODUK") {
                    await rowObj.delete();
                } else {
                    const stokLama = Number(rowObj.get("Stok") || 0);
                    if (aksi === "tambah") {
                        stokTerkini = stokLama + jumlah;
                    } else {
                        stokTerkini = stokLama - jumlah;
                        if (stokTerkini < 0) {
                            bot.sendMessage(chatId, `⚠️ **TRANSAKSI BATAL!** Sisa stok riil: *${stokLama} pcs*.`, { parse_mode: 'Markdown', ...menuUtama() });
                            delete userState[chatId];
                            return;
                        }
                    }
                    rowObj.set("Stok", stokTerkini);
                    rowObj.set("Waktu Update", waktuSekarang);
                    await rowObj.save();
                }

                const waktuLog = new Date().toLocaleString('id-ID');
                await sheetLog.addRow([waktuLog, namaBarang, aksi.toUpperCase(), jumlah, keterangan]);
                bot.sendMessage(chatId, `✅ **Data Sheet1 Berhasil Di-update!**`, menuUtama());

                if (["kurang", "tambah", "SET STOK AWAL"].includes(aksi)) {
                    const valThreshold = Number(rowObj.get("Threshold") || 0);
                    if (valThreshold && stokTerkini <= valThreshold) {
                        for (const adminId of USER_DI_IZINKAN) {
                            try {
                                bot.sendMessage(adminId, `🚨 **SISTEM WARNING STOK!**\n\n📦 Produk: *${namaBarang}*\n📊 Sisa Stok: *{stokTerkini}* pcs`, { parse_mode: 'Markdown' });
                            } catch (e) {}
                        }
                    }
                }
            } catch (e) {
                bot.sendMessage(chatId, `❌ Gagal memproses data: ${e.message}`, menuUtama());
            }
            delete userState[chatId];
        }
    }
});

// --- COMMAND ADMIN EKSTRA ---
bot.onText(/\/tambah_produk/, (msg) => {
    if (!punyaAkses(msg)) return;
    const chatId = msg.chat.id;
    userState[chatId] = { step: 'PROSES_NAMA_BARU', aksi: 'PRODUK BARU' };
    bot.sendMessage(chatId, "📝 Ketik **NAMA BARANG BARU** yang ingin dimasukkan ke Sheet1:\n*(Atau ketik /cancel)*", { parse_mode: 'Markdown' });
});

bot.onText(/\/clear_produk/, (msg) => {
    if (!punyaAkses(msg)) return;
    const chatId = msg.chat.id;
    userState[chatId] = { step: 'CLEAR_TOTAL' };
    bot.sendMessage(chatId, "💥 **WIPE OUT TOTAL** 💥\nKetik **NAMA BARANG** yang ingin dihapus bersih akarnya dari Sheet1 & Sheet3:");
});

// Handler untuk command berbasis inline pemilihan barang
async function handleAdminCommand(msg, cmdType) {
    if (!punyaAkses(msg)) return;
    const chatId = msg.chat.id;
    const records = await ambilDataSheets();
    if (!records.length) {
        bot.sendMessage(chatId, "⚠️ Spreadsheet master kosong.");
        return;
    }

    const inlineKeyboard = records
        .filter(row => row["Nama Barang"])
        .map((row, index) => [{
            text: row["Nama Barang"],
            callback_data: `${cmdType}:${index}`
        }]);

    bot.sendMessage(chatId, `Pilih barang di Sheet1 untuk aksi *${cmdType}*:`, {
        reply_markup: { inline_keyboard: inlineKeyboard },
        parse_mode: 'Markdown'
    });
}

bot.onText(/\/edit_produk/, (msg) => handleAdminCommand(msg, '/edit_produk'));
bot.onText(/\/set_stok/, (msg) => handleAdminCommand(msg, '/set_stok'));
bot.onText(/\/set_threshold/, (msg) => handleAdminCommand(msg, '/set_threshold'));
bot.onText(/\/hapus_produk/, (msg) => handleAdminCommand(msg, '/hapus_produk'));

// --- INLINE CALLBACK QUERY HANDLER ---
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    try {
        await bot.deleteMessage(chatId, query.message.message_id);
    } catch (e) {}

    const [context, dataTarget] = data.split(":");
    const rowIndex = parseInt(dataTarget);
    const rows = await sheetMaster.getRows();
    
    if (!rows[rowIndex]) {
        bot.sendMessage(chatId, "❌ Gagal membaca data produk. Sesi kedaluwarsa.", menuUtama());
        return;
    }

    const namaAsliBarang = String(rows[rowIndex].get("Nama Barang") || "").trim();

    if (context === 'harian') {
        const aksiHarian = userState[chatId]?.aksi;
        if (!aksiHarian) return;
        userState[chatId].barang = namaAsliBarang;
        userState[chatId].step = 'MINTA_KETERANGAN_TRANSAKSI';
        bot.sendMessage(chatId, `🔢 Masukkan jumlah kuantitas penyesuaian **${aksiHarian.toUpperCase()}** untuk *{namaAsliBarang}* di Sheet1:`, { parse_mode: 'Markdown' });
    }
    else if (context === '/set_stok') {
        userState[chatId] = { barang: namaAsliBarang, aksi: 'SET STOK AWAL', step: 'MINTA_KETERANGAN_TRANSAKSI' };
        bot.sendMessage(chatId, `🔢 Masukkan nominal **STOK BARU** (Overwrite) untuk *{namaAsliBarang}*:`, { parse_mode: 'Markdown' });
    }
    else if (context === '/set_threshold') {
        userState[chatId] = { barang: namaAsliBarang, aksi: 'SET THRESHOLD', step: 'MINTA_KETERANGAN_TRANSAKSI' };
        bot.sendMessage(chatId, `🔢 Masukkan limit **THRESHOLD BARU** untuk *{namaAsliBarang}*:`, { parse_mode: 'Markdown' });
    }
    else if (context === '/edit_produk') {
        userState[chatId] = { barang: namaAsliBarang, step: 'EDIT_NAMA_BARU' };
        bot.sendMessage(chatId, `🔤 Masukkan **NAMA BARU** produk *{namaAsliBarang}* untuk tabel Sheet1:`, { parse_mode: 'Markdown' });
    }
    else if (context === '/hapus_produk') {
        userState[chatId] = { barang: namaAsliBarang, aksi: 'HAPUS PRODUK', step: 'EKSEKUSI_TRANSAKSI_FINAL', jumlah_input: 0 };
        bot.sendMessage(chatId, `📝 Masukkan **ALASAN** mengapa produk *{namaAsliBarang}* ini dihapus dari Sheet1:`, { parse_mode: 'Markdown' });
    }
});

// ========================================================
// 4. RUN ENGINE BOT
// ========================================================
console.log("🤖 Bot Kasir Sinkronisasi (Node.js) Berjalan...");
