# Folder `models/` — Artefak Model Machine Learning

Folder ini menyimpan hasil pelatihan (*trained artifacts*) dari pipeline di [../notebooks/fair_value_pipeline.ipynb](../notebooks/fair_value_pipeline.ipynb) dalam format `.joblib`.

## Apa Itu File `.joblib` dan Kenapa Disimpan?

`.joblib` adalah format serialisasi objek Python (standar industri untuk `scikit-learn` dan array NumPy). Dengan menyimpan model yang sudah dilatih ke file `.joblib`:

- Aplikasi **Scouting Dashboard** (misalnya Streamlit/Gradio/FastAPI) tidak perlu membaca ulang dataset mentah dan melatih ulang ketiga model dari nol setiap kali dijalankan.
- Proses memuat model dan melakukan prediksi harga wajar pemain (*inference*) hanya membutuhkan hitungan milidetik.

---

## Daftar File di Folder Ini

| Nama File | Isi & Struktur | Kegunaan |
| :--- | :--- | :--- |
| `best_model.joblib` | `sklearn.pipeline.Pipeline` lengkap (*preprocessor* + estimator **XGBoost**) | Digunakan untuk prediksi cepat *Fair Market Value* menggunakan model terbaik. |
| `all_models.joblib` | `dict` berisi 3 `Pipeline`: `"Linear Regression"`, `"Random Forest"`, `"XGBoost"` | Digunakan di dashboard untuk menampilkan perbandingan hasil prediksi ketiga model secara berdampingan. |
| `preprocessor.joblib` | `sklearn.compose.ColumnTransformer` yang sudah di-*fit* (`passthrough` numerik + `OneHotEncoder` kategorikal) | Digunakan ketika aplikasi membutuhkan matriks fitur hasil transformasi secara terpisah (misalnya untuk perhitungan nilai **SHAP**). |
| `model_metadata.joblib` | `dict` berisi `best_model_name`, `numeric_features`, `categorical_features`, `feature_cols`, `evaluation_metrics`, dan `best_params` | Menyimpan daftar kolom input yang diharapkan, metrik evaluasi (RMSE, $R^2$, MAE), dan hyperparameter terbaik agar tidak perlu di-*hardcode* di dashboard. |

---

## Fitur Input yang Dibutuhkan

Model menerima DataFrame dengan **23 kolom input** (`20` numerik + `3` kategorikal) sesuai dataset bersih [../dataset/processed/players_clean.csv](../dataset/processed/players_clean.csv):

- **Fitur Numerik (20):**
  `age`, `height_in_cm`, `contract_months_left`, `total_minutes`, `minutes_per_match`, `goals_per_90`, `assists_per_90`, `yellow_cards_per_90`, `red_cards_per_90`, `international_caps`, `cl_appearances`, `el_appearances`, `is_top5_league`, `club_national_team_players`, `club_stadium_seats`, `club_foreigners_pct`, `recent_minutes`, `recent_goals_per_90`, `recent_assists_per_90`, `recent_cl_appearances`
- **Fitur Kategorikal (3):**
  `position`, `foot`, `league_group`

---

## Contoh Cara Memakai di Python / Dashboard

Target pelatihan menggunakan skala logaritmik (`np.log1p`), sehingga hasil `.predict()` **wajib dikembalikan ke skala Euro asli** menggunakan `np.expm1`:

```python
import joblib
import numpy as np
import pandas as pd

# Muat model, seluruh model pembanding, dan metadata
best_model = joblib.load("models/best_model.joblib")
all_models = joblib.load("models/all_models.joblib")
metadata = joblib.load("models/model_metadata.joblib")

# Contoh mengambil 1 baris data pemain dari dataset bersih
df_clean = pd.read_csv("dataset/processed/players_clean.csv")
X_sample = df_clean[metadata["feature_cols"]].iloc[[0]]

# 1. Prediksi dengan model terbaik (XGBoost)
pred_log = best_model.predict(X_sample)
pred_eur = np.expm1(np.clip(pred_log, 0.0, 20.0))[0]
print(f"Estimasi Fair Value ({metadata['best_model_name']}): €{pred_eur:,.0f}")

# 2. Komparasi prediksi 3 model
for model_name, pipe in all_models.items():
    val_eur = np.expm1(np.clip(pipe.predict(X_sample), 0.0, 20.0))[0]
    print(f"- {model_name}: €{val_eur:,.0f}")
```

---

## Cara Memperbarui / Melatih Ulang Model

Jika terdapat perubahan fitur, parameter model, atau pembaruan data mentah di `dataset/`, jalankan ulang seluruh cell pada [../notebooks/fair_value_pipeline.ipynb](../notebooks/fair_value_pipeline.ipynb) dari awal hingga akhir (Bagian 4 akan otomatis menimpa keempat file `.joblib` di folder ini).
