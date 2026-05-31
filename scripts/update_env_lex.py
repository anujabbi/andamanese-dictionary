import json
import os

env_categories = [
    "bird", "boat related", "direction", "edible fruit", "edible items",
    "fire", "fish", "flora", "hunting and gathering", "marine", "medicine",
    "natural environment", "navigation", "place", "reptile", "season",
    "space", "super natural", "insect and invertebrate"
]

index_path = '/home/hermes/projects/andamanese-dictionary/assets/search-index.json'

with open(index_path, 'r', encoding='utf-8') as f:
    index = json.load(f)

for entry in index:
    category = entry.get('cat', '').lower()
    # Normalize category names to handle potential spacing issues (like "edible fruit " etc)
    # The list provided by Anuj was: bird, boat related, direction,edible fruit , edible items, fire, fish , flora, hunting and gathering, marine,medicine, natural environment, navigation, place , reptile season,space, super natural, insect and invertebrate.
    # Note: "reptile season" in the list looks like a typo for "reptile", "season"
    
    match = False
    for env_cat in env_categories:
        if env_cat in category:
            match = True
            break
            
    if 'reptile' in category or 'season' in category:
        match = True
        
    if match:
        entry['env_lex_new'] = True

with open(index_path, 'w', encoding='utf-8') as f:
    json.dump(index, f, indent=2, ensure_ascii=False)

print("Updated search-index.json with env_lex_new tags.")
