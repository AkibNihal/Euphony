import sys
import json
import pandas as pd
import difflib
from sklearn.metrics.pairwise import cosine_similarity
import random

# Load your song data
df = pd.read_csv("/home/nihal/Desktop/edoc/proj/Euphony/euphony_backend/utils/song.csv")

def recommend_similar_songs(user_liked_songs, number=50):
    common_recommendations = []

    # Shuffle the user_liked_songs for randomness
    random.shuffle(user_liked_songs)

    # Use the first 5 liked songs for recommendations
    for user_song_name in user_liked_songs[:5]:
        song_name = user_song_name.lower()

        # Find close match using difflib
        list_of_all_songs = df['Track'].tolist()
        find_close_match = difflib.get_close_matches(song_name, list_of_all_songs)

        if not find_close_match:
            print(f"No close match found for '{user_song_name}'.")
            continue

        close_match = find_close_match[0]

        # Get index of the song
        index_of_song = df[df['Track'] == close_match].index[0]

        # Select only numerical columns for similarity calculation
        numerical_cols = ['Danceability', 'Energy', 'Loudness', 'Speechiness', 'Acousticness', 'Instrumentalness', 'Liveness', 'Valence', 'Tempo', 'Views']
        selected_numerical_cols = df[numerical_cols].copy()

        # Calculate similarity scores
        similarity_score = list(enumerate(cosine_similarity(selected_numerical_cols.iloc[[index_of_song]], selected_numerical_cols)[0]))

        # Sort similar songs
        sorted_similar_songs = sorted(similarity_score, key=lambda x: x[1], reverse=True)

        recommendations = []
        i = 1
        for song in sorted_similar_songs:
            index = song[0]
            title_from_index = df.iloc[index]['Track']
            if i <= number:
                common_recommendations.append(title_from_index)
                i += 1

    return common_recommendations

if len(sys.argv) > 1:
    # Get liked songs from command-line arguments
    liked_songs = json.loads(sys.argv[1])

    # Perform recommendations for the first 5 shuffled liked songs and find suggestions
    common_recommendations = recommend_similar_songs(liked_songs, number=50)

    # Output common recommendations as JSON
    print(json.dumps({"recommendations": common_recommendations}))
else:
    print("No command-line arguments provided.")
