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
