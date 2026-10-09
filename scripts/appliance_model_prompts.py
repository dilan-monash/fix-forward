"""Shared operational prompts for offline appliance-model experiments.

The public website does not import this Python module. Keeping one reviewed
prompt map prevents dataset scoring and benchmark experiments from silently
using different meanings for the same FixForward category.
"""

CLASS_PROMPTS = {
    "air_fryer": "a photo of an electric countertop air fryer appliance",
    "blender": "a photo of an electric kitchen blender with a blending jug",
    "coffee_machine": "a photo of an electric coffee maker or espresso machine",
    "dehumidifier": "a photo of a portable electric room dehumidifier",
    "fan": "a photo of a portable electric room fan",
    "food_processor": "a photo of an electric food processor with a bowl",
    "hair_dryer": "a photo of a handheld electric hair dryer",
    "kettle": "a photo of an electric water kettle with its base",
    "microwave": "a photo of a countertop microwave oven",
    "mixer": "a photo of an electric stand mixer or electric hand mixer",
    "portable_ac": "a photo of a portable air conditioner on wheels",
    "portable_heater": "a photo of a portable electric room space heater",
    "rice_cooker": "a photo of an electric rice cooker appliance",
    "sandwich_press": "a photo of an electric sandwich press or panini maker",
    "shaver": "a photo of an electric shaver or electric beard trimmer",
    "steam_cleaner": "a photo of an electric steam cleaner appliance",
    "straightener": "a photo of an electric hair straightener",
    "toaster": "a photo of an electric bread toaster",
    "vaccum_cleaner": "a photo of an electric vacuum cleaner",
}

# These prompts exist only to catch unsupported content. They must never become
# appliance suggestions or safety conclusions in the adult journey.
OOD_PROMPTS = {
    "other_kitchen_appliance": "a photo of another kitchen appliance not listed",
    "built_in_oven": "a photo of a built-in conventional oven or cooking range",
    "refrigerator": "a photo of a refrigerator",
    "washing_machine": "a photo of a washing machine",
    "screen_device": "a photo of a television, laptop, tablet, or mobile phone",
    "person_or_pet": "a photo of a person or pet",
    "furniture": "a photo of furniture or a room",
    "vehicle": "a photo of a car or another vehicle",
    "nature": "a photo of a flower, plant, or tree",
    "other_object": "a photo of an unrelated household object",
}
