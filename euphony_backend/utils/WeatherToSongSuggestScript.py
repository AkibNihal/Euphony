import json
import pandas as pd
import requests
from sklearn.tree import DecisionTreeClassifier

# Load the dataset from CSV file
df = pd.read_csv('/home/nihal/Desktop/edoc/proj/Euphony/euphony_backend/utils/weather_mood_data.csv')

# Split the data into features (X) and target variable (y)
X = df.drop('mood', axis=1)
y = df['mood']

# Create a decision tree classifier
clf = DecisionTreeClassifier()

# Train the classifier
clf.fit(X, y)

# Load the song dataset
song_df = pd.read_csv('/home/nihal/Desktop/edoc/proj/Euphony/euphony_backend/utils/song.csv')
col_to_keep = ['id', 'Track', 'Valence', 'Views']
col_to_drop = [col for col in song_df.columns if col not in col_to_keep]
song_df = song_df.drop(columns=col_to_drop)

## drop rows with null values
song_df.dropna()

song_df = song_df.sort_values(by='Views', ascending=False)

def get_user_location():
    endpoint = 'http://ip-api.com/json/?fields=country,city'

    try:
        response = requests.get(endpoint)
        response.raise_for_status()  # Check for HTTP errors

        data = response.json()
        return data['city']
    
    except requests.exceptions.RequestException as e:
        print('Error:', e)
        return None

def get_weather_data(city):
    url = "https://weather-by-api-ninjas.p.rapidapi.com/v1/weather"
    querystring = {"city": city}

    headers = {
        "X-RapidAPI-Key": "291c38cd95msh3f1c2c176666ab0p1c53b6jsn717111b85e3f",
        "X-RapidAPI-Host": "weather-by-api-ninjas.p.rapidapi.com",
    }

    response = requests.get(url, headers=headers, params=querystring)
    return response.json()

def detect_weather_mood():
    city = get_user_location()
    weather_data = get_weather_data(city)
    
    # Extract relevant weather information
    temperature = weather_data['temp']
    humidity = weather_data['humidity']
    cloud_pct = weather_data['cloud_pct']
    wind_speed = weather_data['wind_speed']

    # Create a DataFrame for the new data
    new_data = pd.DataFrame({
        'temperature': [temperature],
        'cloud_pct': [cloud_pct],
        'humidity': [humidity],
        'wind_speed': [wind_speed]
    })
    
    new_prediction = clf.predict(new_data)[0]
    return new_prediction

def recommend_songs_based_on_weather():
    mood = detect_weather_mood()

    recommendations = []

    for index, row in song_df.iterrows():
        if mood == 'happy' and row['Valence'] >= 0.7:
            recommendations.append(row['Track'])
        elif mood == 'sad' and row['Valence'] <= 0.3:
            recommendations.append(row['Track'])
        
        if len(recommendations) == 50:
            break

    return recommendations

# Perform recommendations based on weather mood and find suggestions
common_recommendations = recommend_songs_based_on_weather()

# Output common recommendations as JSON
print(json.dumps({"recommendations": common_recommendations}))
