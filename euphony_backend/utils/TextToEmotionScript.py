import pandas as pd
import numpy as np
from nltk.sentiment import SentimentIntensityAnalyzer
import nltk
import sys
import json

nltk.download('vader_lexicon')

class SongsSuggestModel:
    def __init__(self, song_csv_path='/home/nihal/Desktop/edoc/proj/Euphony/euphony_backend/utils/song.csv'):
        self.song_df = pd.read_csv(song_csv_path)
        self.col_to_keep = ['id', 'Track', 'Valence', 'Views']
        self.col_to_drop = [col for col in self.song_df.columns if col not in self.col_to_keep]
        self.song_df = self.song_df.drop(columns=self.col_to_drop)
        self.song_df = self.song_df.dropna()
        self.song_df = self.song_df.sort_values(by='Views', ascending=False)

    def detect_emotion(self, text):
        # Initialize the sentiment analyzer
        sid = SentimentIntensityAnalyzer()

        # Get the sentiment scores
        sentiment_scores = sid.polarity_scores(text)

        # As the score is between [-1,1] normalize it to be within [0,1]
        normalized_score = (sentiment_scores['compound'] + 1) / 2
        # print("Emotion detected:", normalized_score)

        return normalized_score

    def recommend_songs(self, text):
        valence_score = self.detect_emotion(text)
        recommendations = []

        for index, row in self.song_df.iterrows():
            if abs(row['Valence'] - valence_score) < 0.2:  # allowing 10% deviation
                recommendations.append(row['Track'])

            if len(recommendations) == 5000:
                break

        recommendations.sort(key=lambda x: self.song_df[self.song_df['Track'] == x]['Views'].values[0], reverse=True)

        return recommendations[:200]

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Get text input from command-line arguments
        text_input = sys.argv[1]

        # Assuming you want to use the recommend_songs method
        model = SongsSuggestModel()
        common_recommendations = model.recommend_songs(text_input)

        # Output common recommendations as JSON
        print(json.dumps({"recommendations": common_recommendations}))
    else:
        print("No command-line arguments provided.")
