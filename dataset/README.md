# Folder `dataset/` — Sumber & Panduan Dataset

Folder ini digunakan untuk menyimpan dataset mentah Transfermarkt dan hasil data bersihnya.

## Kenapa File CSV Mentah Tidak Ada di GitHub?

File CSV mentah dari Kaggle berukuran sangat besar (total ~900 MB, dengan `game_lineups.csv` mencapai **396.71 MB**, `appearances.csv` **189.21 MB**, dan `game_events.csv` **170.80 MB**), sehingga melebihi batas ukuran file maksimum GitHub (**100 MB per file**). Karena itu, seluruh file `dataset/*.csv` dikecualikan melalui `.gitignore`.

## Data yang Sudah Tersedia di Repo

- [processed/players_clean.csv](processed/players_clean.csv) (**10.281 pemain**, 25 kolom, bebas *missing values*) sudah tersedia langsung di repository ini dan siap dipakai untuk melatih ulang model atau membangun **Scouting Dashboard**.

## Cara Mengunduh Dataset Mentah (Jika Ingin Menjalankan Notebook dari Awal)

1. Unduh dataset dari Kaggle: **[Football Data from Transfermarkt (David Cariboo)](https://www.kaggle.com/datasets/davidcariboo/player-scores)**.
2. Ekstrak dan letakkan minimal 5 file berikut ke dalam folder `dataset/`:
   - `players.csv`
   - `appearances.csv`
   - `clubs.csv`
   - `competitions.csv`
   - `player_valuations.csv`
3. Jalankan seluruh cell pada [../notebooks/fair_value_pipeline.ipynb](../notebooks/fair_value_pipeline.ipynb) dari awal hingga akhir.
