"""Check release identity without loading private settings or opening a database."""

import os
import unittest
from unittest.mock import patch

from backend.config import Settings


class ReleaseConfigTests(unittest.TestCase):
    """Distinguish the branch fallback from a hosting service's explicit label."""

    def settings_with_environment(self, environment):
        # Clear inherited credentials and bypass the ignored .env loader. These
        # checks exercise configuration only; they never build the Flask app.
        with patch.dict(os.environ, environment, clear=True):
            with patch("dotenv.load_dotenv") as load_local_settings:
                settings = Settings.from_environment()
                load_local_settings.assert_called_once()
                return settings

    def test_iteration_three_is_the_default_without_an_override(self):
        settings = self.settings_with_environment({})

        self.assertEqual(settings.release_version, "iteration-3-v3.0.0")
        self.assertEqual(settings.database_url, "")

    def test_explicit_release_setting_overrides_the_branch_default(self):
        # A deliberately old label demonstrates why a source change alone does
        # not update a Render service that already supplies RELEASE_VERSION.
        settings = self.settings_with_environment(
            {"RELEASE_VERSION": "  iteration-2-v2.0.0-quest  "}
        )

        self.assertEqual(settings.release_version, "iteration-2-v2.0.0-quest")
        self.assertEqual(settings.database_url, "")


if __name__ == "__main__":
    unittest.main()
