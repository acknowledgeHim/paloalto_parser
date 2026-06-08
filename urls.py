Step 2 — Wire up the URL

  In your urls.py:

  from myapp.views import languagetool_proxy   # adjust import path

  urlpatterns = [
      ...
      path("lt/check/", languagetool_proxy, name="lt_check"),
  ]

  ---

