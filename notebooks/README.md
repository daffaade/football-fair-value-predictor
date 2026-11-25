# Folder `notebooks/` — Pipeline Data Mining & Pemodelan

Folder ini berisi notebook *end-to-end* [fair_value_pipeline.ipynb](fair_value_pipeline.ipynb) untuk memprediksi harga pasar wajar (*Fair Market Value*) pemain sepak bola berbasis data Transfermarkt dan mendeteksi pemain yang masuk radar **Undervalued** (konsep *Moneyball*).

---

## Struktur Pipeline

Notebook dibagi menjadi 4 bagian berurutan:

### 1. Bagian 1 — EDA & Uji Korelasi
- Memuat 5 tabel mentah dari `../dataset/`: `players.csv`, `appearances.csv`, `clubs.csv`, `competitions.csv`, dan `player_valuations.csv`.
- Mengagregasi statistik performa level pemain, baik **akumulasi karier** maupun ***recent form* 1 musim terakhir** (jendela 365 hari sebelum `latest_valuation_date` masing-masing pemain).
- Melakukan audit kualitas data (*missing values*, duplikat, tipe data, *outliers* dengan metode IQR).
- Menganalisis distribusi target `market_value_in_eur` yang sangat *right-skewed* dan memvalidasi transformasi `np.log1p`.
- Menguji korelasi **Pearson** dan **Spearman** terhadap target asli maupun target log.

### 2. Bagian 2 — Data Cleaning, Feature Engineering & Selection
- Memfilter pemain aktif (`last_season >= 2024`), memiliki valuasi valid, posisi terdefinisi, dan minimal `270` menit bermain agar metrik per-90 stabil (**10.281 pemain**).
- Merekayasa fitur multidimensi: `age`, `contract_months_left`, statistik karier per-90 (`goals_per_90`, `assists_per_90`, `yellow_cards_per_90`, `red_cards_per_90`), serta fitur *recent form* 1 musim terakhir (`recent_minutes`, `recent_goals_per_90`, `recent_assists_per_90`, `recent_cl_appearances`).
- Melakukan *winsorizing* persentil ke-99 pada metrik rasio per-90, mengecualikan `highest_market_value_in_eur` untuk mencegah *data leakage*, dan memverifikasi tidak ada multikolinearitas tinggi (`|r| > 0.85`).
- Menghasilkan **23 fitur input** (`20` numerik + `3` kategorikal) dan mengekspor dataset bersih ke [../dataset/processed/players_clean.csv](../dataset/processed/players_clean.csv).

### 3. Bagian 3 — Modelling, Hyperparameter Tuning & Evaluasi
- Membagi data menjadi *train* (80% / 8.224 pemain) dan *test* (20% / 2.057 pemain) dengan `random_state=42`.
- Membungkus `StandardScaler` / `OneHotEncoder` di dalam `sklearn.pipeline.Pipeline` agar bebas *data leakage*.
- Melatih **Linear Regression** sebagai *baseline*, serta melakukan *hyperparameter tuning* **5-fold `RandomizedSearchCV`** (`scoring="neg_root_mean_squared_error"`) pada **Random Forest** dan **XGBoost**.
- Mengevaluasi performa *Train vs Test* pada skala log dan skala Euro asli (`np.expm1`):

| Model | Test $R^2_{\log}$ | Overfit Gap ($\log$) | Test $R^2_{\text{EUR}}$ | Test RMSE (EUR) | Test MAE (EUR) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **XGBoost** *(Terbaik)* | **0.8399** | **0.0856** | **0.8463** | **€4,149,951** | **€1,716,886** |
| **Random Forest** | 0.8110 | 0.1111 | 0.7772 | €4,997,324 | €1,905,589 |
| **Linear Regression** | 0.7616 | -0.0067 | 0.6624 | €6,151,056 | €2,254,611 |

### 4. Bagian 4 — Feature Importance, Deteksi Undervalued & Ekspor Model
- Memvisualisasikan **Top 15 Feature Importance** dari model terbaik (**XGBoost**).
- Menyusun daftar pemain berstatus **Undervalued** (`Predicted_Fair_Value_EUR > Actual_Market_Value_EUR`) beserta selisih nominal dan persentasenya pada data *test*.
- Menyimpan seluruh artefak model ke folder [../models/](../models/README.md) menggunakan `joblib`.

---

## Daftar Variabel Pelatihan (23 Fitur Input + 1 Target)

### Fitur Numerik (20 Variabel)

1. **Profil Fisik & Kontrak (3):**
   - `age`: Usia pemain pada saat tanggal valuasi terbaru (tahun).
   - `height_in_cm`: Tinggi badan pemain (cm).
   - `contract_months_left`: Sisa masa kontrak pemain (bulan).
2. **Performa & Disiplin *All-Time* / Sepanjang Karier (6):**
   - `total_minutes`: Total menit bermain sepanjang karier.
   - `minutes_per_match`: Rata-rata menit bermain per pertandingan.
   - `goals_per_90`: Rata-rata gol per 90 menit (karier).
   - `assists_per_90`: Rata-rata assist per 90 menit (karier).
   - `yellow_cards_per_90`: Rata-rata kartu kuning per 90 menit (disiplin).
   - `red_cards_per_90`: Rata-rata kartu merah per 90 menit (disiplin).
3. **Performa *Recent Form* / 1 Musim Terakhir — 365 Hari (4):**
   - `recent_minutes`: Total menit bermain dalam 365 hari sebelum tanggal valuasi terbaru.
   - `recent_goals_per_90`: Rata-rata gol per 90 menit pada 1 musim terakhir (`0.0` jika `recent_minutes < 90`).
   - `recent_assists_per_90`: Rata-rata assist per 90 menit pada 1 musim terakhir (`0.0` jika `recent_minutes < 90`).
   - `recent_cl_appearances`: Jumlah penampilan Liga Champions dalam 1 musim terakhir.
4. **Pengalaman Internasional & Kompetisi Eropa (3):**
   - `international_caps`: Jumlah penampilan bersama tim nasional senior.
   - `cl_appearances`: Total penampilan Liga Champions sepanjang karier.
   - `el_appearances`: Total penampilan Liga Europa sepanjang karier.
5. **Reputasi & Level Klub / Liga (4):**
   - `is_top5_league`: Indikator biner (`1`/`0`) apakah klub berada di Top 5 Liga Eropa (`GB1`, `ES1`, `IT1`, `L1`, `FR1`).
   - `club_national_team_players`: Jumlah pemain tim nasional di klub saat ini.
   - `club_stadium_seats`: Kapasitas stadion klub saat ini.
   - `club_foreigners_pct`: Persentase pemain asing di klub saat ini.

### Fitur Kategorikal (3 Variabel → *One-Hot Encoded*)
- `position`: Posisi utama pemain (`Attack`, `Midfield`, `Defender`, `Goalkeeper`).
- `foot`: Kaki dominan (`right`, `left`, `both`, `unknown`).
- `league_group`: Grup liga domestik (`GB1`, `ES1`, `IT1`, `L1`, `FR1`, `NL1`, `PO1`, `BE1`, `TR1`, `RU1`, `SC1`, `GR1`, `DK1`, `UKR1`, `Other`).

*(Setelah One-Hot Encoding pada model berbasis tree, total dimensi fitur menjadi **43 kolom**).*

### Variabel Target & Kolom yang Dikecualikan
- **Target (`y`):** `log_market_value` = `np.log1p(market_value_in_eur)` saat proses *training*, lalu dikembalikan ke skala Euro asli (`np.expm1`) untuk evaluasi dan prediksi.
- **Dikecualikan (*Anti-Leakage* & Metadata):** `highest_market_value_in_eur` serta kolom identitas (`player_id`, `name`, `current_club_name`, `last_season`) tidak digunakan sebagai fitur `X` agar tidak terjadi *data leakage*.

---

## Kenapa Menggunakan Statistik *All-Time* dan *Recent Form* Bersamaan?

Kedua kelompok fitur memiliki peran berbeda yang saling melengkapi saat model menaksir **Fair Market Value ($\hat{y}$)**:

- **Peran Statistik *All-Time* (Sepanjang Karier):** Mengukur rekam jejak, pengalaman, dan konsistensi jangka panjang (*pedigree*). Fitur ini membedakan pemain yang sudah teruji bertahun-tahun di level tertinggi dari *one-season wonder*, sekaligus menjadi penyangga bagi pemain bintang yang kebetulan cedera di musim terakhir.
- **Peran Statistik *Recent Form* (1 Musim Terakhir):** Mengukur performa terkini, status *starter*, dan momentum pemain di bursa transfer saat ini. Dengan adanya *recent form*, model dapat membedakan:
  1. **Pemain muda yang sedang *breakout*** (menit karier masih kecil, tetapi menit & kontribusi terbaru tinggi).
  2. **Pemain cadangan / pemain yang mulai meredup** (menit karier besar, tetapi `recent_minutes` minim/nol sehingga harganya turun).
  3. **Pemain senior yang masih tajam** (usia tua tidak langsung menjatuhkan valuasi jika kontribusi 1 musim terakhirnya tetap tinggi).
- **Hubungan ke Deteksi *Undervalued*:** Deteksi pemain *Undervalued* tidak memakai model ML terpisah, melainkan membandingkan hasil prediksi **Fair Market Value ($\hat{y}$)** terhadap harga aktual Transfermarkt ($y$). Karena kombinasi *all-time* + *recent form* meningkatkan akurasi prediksi harga wajar secara signifikan (Test $R^2_{\text{EUR}}$ XGBoost naik dari `0.7476` menjadi `0.8463`), daftar radar **Undervalued** pun menjadi jauh lebih akurat.

---

## Prasyarat & Cara Menjalankan

1. **Dataset Mentah:** Pastikan 5 file CSV mentah Transfermarkt sudah diletakkan di `../dataset/`. Panduan unduh tersedia di [../dataset/README.md](../dataset/README.md).
2. **Dependensi Python:**
   `pandas`, `numpy`, `matplotlib`, `seaborn`, `scikit-learn`, `xgboost`, `joblib`, `jupyter`
3. **Menjalankan Notebook:**
   - **Via Jupyter / VS Code:** Buka [fair_value_pipeline.ipynb](fair_value_pipeline.ipynb) lalu pilih **Run All** (pastikan *working directory* berada di folder `notebooks/`).
   - **Via CLI (dari root repository):**
     ```bash
     python -m jupyter nbconvert --to notebook --execute --inplace --ExecutePreprocessor.timeout=600 notebooks/fair_value_pipeline.ipynb
     ```

---

## Output yang Dihasilkan

| Output | Lokasi | Keterangan |
| :--- | :--- | :--- |
| Dataset bersih | [../dataset/processed/players_clean.csv](../dataset/processed/players_clean.csv) | 10.281 baris x 29 kolom, 0 *missing values* |
| Artefak model & metadata | [../models/README.md](../models/README.md) | `best_model.joblib`, `all_models.joblib`, `preprocessor.joblib`, `model_metadata.joblib` |
