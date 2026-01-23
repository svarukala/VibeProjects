import pandas as pd
from openpyxl import Workbook

# Dummy episode and cast data for demonstration
# For full episode lists, you can expand these lists or use APIs like TVMaze, OMDb, or Wikipedia scraping

shows = {
    "Friends": {
        "episodes": [
            {"Season": 1, "Episode": 1, "Title": "The One Where Monica Gets a Roommate", "Director": "James Burrows", "Synopsis": "Monica and the gang introduce Rachel to the real world.", "OTT Platform": "Max", "Air Date": "1994-09-22", "Runtime": "22 min", "Rating": 8.1},
            # ... Add all episodes for Friends here
        ],
        "cast": [
            {"Actor Name": "Jennifer Aniston", "Character": "Rachel Green", "Nationality": "American", "Awards": "Emmy, Golden Globe"},
            {"Actor Name": "Courteney Cox", "Character": "Monica Geller", "Nationality": "American", "Awards": ""},
            {"Actor Name": "Lisa Kudrow", "Character": "Phoebe Buffay", "Nationality": "American", "Awards": "Emmy"},
            {"Actor Name": "Matt LeBlanc", "Character": "Joey Tribbiani", "Nationality": "American", "Awards": "Emmy Nominee"},
            {"Actor Name": "Matthew Perry", "Character": "Chandler Bing", "Nationality": "Canadian-American", "Awards": "Emmy Nominee"},
            {"Actor Name": "David Schwimmer", "Character": "Ross Geller", "Nationality": "American", "Awards": "Emmy Nominee"},
        ]
    },
    "Breaking Bad": {
        "episodes": [
            {"Season": 1, "Episode": 1, "Title": "Pilot", "Director": "Vince Gilligan", "Synopsis": "Walter White turns to making meth after a cancer diagnosis.", "OTT Platform": "AMC/Netflix", "Air Date": "2008-01-20", "Runtime": "59 min", "Rating": 9.1},
            # ... Add all episodes for Breaking Bad here
        ],
        "cast": [
            {"Actor Name": "Bryan Cranston", "Character": "Walter White", "Nationality": "American", "Awards": "Emmy, Golden Globe"},
            {"Actor Name": "Aaron Paul", "Character": "Jesse Pinkman", "Nationality": "American", "Awards": "Emmy"},
            {"Actor Name": "Anna Gunn", "Character": "Skyler White", "Nationality": "American", "Awards": "Emmy"},
            {"Actor Name": "Dean Norris", "Character": "Hank Schrader", "Nationality": "American", "Awards": ""},
            {"Actor Name": "Betsy Brandt", "Character": "Marie Schrader", "Nationality": "American", "Awards": ""},
            {"Actor Name": "RJ Mitte", "Character": "Walter White Jr.", "Nationality": "American", "Awards": ""},
        ]
    },
    "Prison Break": {
        "episodes": [
            {"Season": 1, "Episode": 1, "Title": "Pilot", "Director": "Brett Ratner", "Synopsis": "Michael Scofield gets imprisoned to break out his brother Lincoln.", "OTT Platform": "Fox/Hulu", "Air Date": "2005-08-29", "Runtime": "45 min", "Rating": 8.7},
            # ... Add all episodes for Prison Break here
        ],
        "cast": [
            {"Actor Name": "Wentworth Miller", "Character": "Michael Scofield", "Nationality": "British-American", "Awards": "Golden Globe Nominee"},
            {"Actor Name": "Dominic Purcell", "Character": "Lincoln Burrows", "Nationality": "Australian", "Awards": ""},
            {"Actor Name": "Sarah Wayne Callies", "Character": "Sara Tancredi", "Nationality": "American", "Awards": ""},
            {"Actor Name": "Amaury Nolasco", "Character": "Fernando Sucre", "Nationality": "Puerto Rican", "Awards": ""},
            {"Actor Name": "Robert Knepper", "Character": "Theodore \"T-Bag\" Bagwell", "Nationality": "American", "Awards": ""},
        ]
    },
    "Lost": {
        "episodes": [
            {"Season": 1, "Episode": 1, "Title": "Pilot (Part 1)", "Director": "J.J. Abrams", "Synopsis": "Survivors of Oceanic Flight 815 crash on a mysterious island.", "OTT Platform": "ABC/Hulu", "Air Date": "2004-09-22", "Runtime": "42 min", "Rating": 9.1},
            # ... Add all episodes for Lost here
        ],
        "cast": [
            {"Actor Name": "Matthew Fox", "Character": "Jack Shephard", "Nationality": "American", "Awards": ""},
            {"Actor Name": "Evangeline Lilly", "Character": "Kate Austen", "Nationality": "Canadian", "Awards": ""},
            {"Actor Name": "Terry O'Quinn", "Character": "John Locke", "Nationality": "American", "Awards": "Emmy"},
            {"Actor Name": "Josh Holloway", "Character": "James \"Sawyer\" Ford", "Nationality": "American", "Awards": ""},
            {"Actor Name": "Jorge Garcia", "Character": "Hugo \"Hurley\" Reyes", "Nationality": "American", "Awards": ""},
            {"Actor Name": "Naveen Andrews", "Character": "Sayid Jarrah", "Nationality": "British", "Awards": ""},
        ]
    }
}

# Create a new workbook
wb = Workbook()
wb.remove(wb.active)  # Remove default sheet

for show, data in shows.items():
    ws = wb.create_sheet(title=show)
    # Episodes Table
    ws.append(["Episodes"])
    episodes_df = pd.DataFrame(data["episodes"])
    for r in pd.concat([pd.DataFrame([episodes_df.columns]), episodes_df]).values:
        ws.append(list(r))
    ws.append([])  # Blank row
    # Cast Table
    ws.append(["Main Cast"])
    cast_df = pd.DataFrame(data["cast"])
    for r in pd.concat([pd.DataFrame([cast_df.columns]), cast_df]).values:
        ws.append(list(r))

# Save the workbook
wb.save("TV_Shows_DummyData.xlsx")
print("Excel file 'TV_Shows_DummyData.xlsx' created with all worksheets and dummy data.")