# Project Context: Sistem Prediksi Fair Market Value & Deteksi Pemain Undervalued

> **Instruksi untuk AI Agent:** File ini adalah *Single Source of Truth* untuk proyek Data Mining ini. Gunakan panduan, arsitektur, aturan bisnis, dan landasan akademik di bawah ini saat membantu menulis kode, melakukan *exploratory data analysis* (EDA), *feature engineering*, pelatihan model, maupun membangun *prototype* dashboard.

## 1. Informasi Umum Proyek

* **Judul:** Sistem Prediksi Fair Market Value Berbasis Data Transfermarkt Menggunakan Komparasi Linear Regression, Random Forest Regressor, dan XGBoost Regressor.
* **Domain:** Data Mining / Sports Analytics / Machine Learning (Regression).
* **Konsep Utama:** *Moneyball* — menaksir harga wajar (*fair market value*) pemain sepak bola secara objektif berbasis data performa dan mengidentifikasi pemain yang harganya di bawah nilai wajarnya (*undervalued*).

## 2. Latar Belakang Masalah (Problem Statement)

Klub sepak bola sering mengalami *overpay* saat merekrut pemain karena valuasi pasar (termasuk penilaian berbasis *crowdsourcing* seperti Transfermarkt) sangat rentan terhadap bias subjektif, *hype* media, dan faktor non-teknis.

Proyek ini membangun pendekatan *data-driven* yang lebih objektif dan transparan untuk:

1. Memprediksi nilai pasar wajar pemain berdasarkan statistik performa dan profil pemain.
2. Membantu proses *scouting* dan negosiasi klub dengan mendeteksi pemain yang masuk radar **Undervalued**.

### Aturan Bisnis (Business Logic)

Status valuasi pemain ditentukan dengan membandingkan hasil prediksi model ($\hat{y}$) terhadap harga pasar aktual ($y_{\text{actual}}$):

* **Undervalued:** Jika $\hat{y} > y_{\text{actual}}$ (Harga prediksi model lebih tinggi daripada harga asli di pasar $\rightarrow$ pemain masuk radar *scouting*).
* **Overvalued:** Jika $\hat{y} < y_{\text{actual}}$ (Harga prediksi model lebih rendah daripada harga asli di pasar).
* **Fairly Valued:** Jika selisih berada dalam margin toleransi tertentu (opsional, dapat diatur di dashboard).

## 3. Dataset & Target Variable

* **Sumber Dataset:** Kaggle — [Football Data from Transfermarkt (David Cariboo)](https://www.kaggle.com/datasets/davidcariboo/player-scores?select=national_teams.csv)
* **Target Variable ($y$):** `market_value_in_eur`
* **Transformasi Target (Wajib Diperhatikan):**
  * Distribusi `market_value_in_eur` bersifat sangat *right-skewed*.
  * Saat proses *training*, target **harus ditransformasi menggunakan logaritma**, misalnya $y_{\text{train}} = \log(1 + \text{market\_value\_in\_eur})$ (`np.log1p`).
  * Saat evaluasi akhir dan tampilan di dashboard, hasil prediksi harus dikembalikan ke skala Euro asli menggunakan eksponensial (`np.expm1`).

## 4. Metodologi & Feature Selection

Pemilihan fitur dalam proyek ini menggunakan pendekatan hibrida (literatur + statistik):

1. **Rujukan Utama Pemilihan Fitur:** Berdasarkan penelitian **Müller et al. (2017)** dan **Fotache et al. (2026)** (contoh fitur kuat: menit bermain, usia, performa gol/assist, posisi, klub/liga, dll.).
2. **Penguat Argumen Multidimensi:** Menggunakan rujukan **Lubis et al.** untuk memperkuat argumen akademik bahwa penilaian *scouting* pemain bola harus bersifat multidimensi mencakup aspek **fisik, teknik, peran posisi, dan disiplin**.
3. **Validasi Statistik:** Fitur kandidat dari literatur wajib divalidasi melalui **uji korelasi** dan *feature importance*. Literatur *scouting* berperan sebagai pendukung/justifikasi domain terhadap hasil uji korelasi (bukan menggantikan hasil uji korelasi jika secara statistik tidak signifikan).

## 5. Arsitektur Pemodelan & Evaluasi

### Model yang Dikomparasi

AI Agent harus membangun *pipeline* yang membandingkan secara adil ketiga algoritma regresi berikut:

1. **Linear Regression** (sebagai *baseline model*).
2. **Random Forest Regressor** (model *ensemble bagging* non-linear).
3. **XGBoost Regressor** (model *ensemble gradient boosting* — hipotesis utama sebagai model dengan performa terbaik).

### Metrik Evaluasi

Evaluasi performa ketiga model wajib menggunakan metrik berikut (konsisten dengan Fotache et al., 2026):

* **RMSE** (*Root Mean Squared Error*)
* $R^2$ (*Coefficient of Determination*)
* *(Opsional tambahan: MAE untuk interpretasi selisih rata-rata dalam Euro)*

### Explainability (Interpretasi Model)

* Gunakan **SHAP (SHapley Additive exPlanations)** pada model terbaik (terutama XGBoost/Random Forest) untuk menjelaskan kontribusi masing-masing fitur (seperti usia dan menit bermain) terhadap harga prediksi pemain.

## 6. Spesifikasi Prototype (Scouting Dashboard)

Prototype akhir berupa aplikasi web interaktif (**Scouting Dashboard**, misal menggunakan Streamlit / Gradio / FastAPI + Web UI) dengan fitur utama:

1. **Mode Pilih Pemain / Input Statistik Manual:** Pengguna dapat memilih pemain yang ada di dataset atau memasukkan statistik pemain baru secara manual.
2. **Estimasi Fair Market Value:** Menampilkan estimasi harga wajar dalam Euro.
3. **Komparasi 3 Model:** Menampilkan perbandingan angka prediksi dari Linear Regression, Random Forest, dan XGBoost secara berdampingan.
4. **Status Valuasi:** Indikator visual yang jelas apakah pemain berstatus **Undervalued** atau **Overvalued** beserta selisih nominal/persentasenya.
5. **Visualisasi SHAP (Nilai Tambah):** Menampilkan alasan/faktor pendorong harga prediksi pemain tersebut.

## 7. Referensi Akademik Wajib

1. **Fotache, M., et al. (2026)** — *Machine Learning for the Prediction of Football Players' Market Value* (MDPI Applied Sciences).
   * **Peran:** Referensi utama yang paling dekat dengan proyek ini (dataset Transfermarkt, komparasi Linear Regression, Random Forest, XGBoost, metrik RMSE & $R^2$, serta interpretasi SHAP).
   * **Link:** https://www.mdpi.com/2076-3417/16/10/5035
2. **Müller, O., Simons, A., & Weinmann, M. (2017)** — *Beyond Crowd Judgments: Data-Driven Estimation of Market Value in Association Football* (European Journal of Operational Research, 263(2), 611–624).
   * **Peran:** Paper fondasi untuk *problem definition* (kelemahan valuasi *crowdsourcing* Transfermarkt dan objektivitas pendekatan *data-driven* untuk *scouting* & negosiasi).
   * **DOI:** `10.1016/j.ejor.2017.05.005`
   * **Link:** https://www.researchgate.net/publication/316871189_Beyond_Crowd_Judgments_Data-Driven_Estimation_of_Market_Value_in_Association_Football
3. **Al-Asadi, M. A., & Tasdemir, S. (2022)** — *Predict the Value of Football Players Using FIFA Video Game Data and Machine Learning Techniques* (IEEE Access, Vol. 10, 22631–22645).
   * **Peran:** Landasan teori perbandingan algoritma regresi (Linear Regression, Multiple Linear Regression, Decision Tree, Random Forest) serta justifikasi pengaruh usia, posisi, dan performa terhadap harga pemain.
   * **DOI:** `10.1109/ACCESS.2022.3154767`
   * **Link:** https://www.researchgate.net/publication/358871715_Predict_the_Value_of_Football_Players_Using_FIFA_Video_Game_Data_and_Machine_Learning_Techniques
4. **Lubis, et al.**
   * **Peran:** Penguat argumen di bab Metodologi bahwa penilaian *scouting* sepak bola harus bersifat multidimensi (fisik, teknik, peran posisi, dan disiplin).