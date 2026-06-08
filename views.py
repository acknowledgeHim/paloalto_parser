In any existing views.py (or a dedicated file), add:

  import requests
  from django.http import JsonResponse
  from django.views.decorators.csrf import csrf_exempt
  from django.views.decorators.http import require_POST

  @csrf_exempt
  @require_POST
  def languagetool_proxy(request):
      resp = requests.post(
          "http://localhost:8081/v2/check",
          data=request.POST,
          timeout=10,
      )
      return JsonResponse(resp.json(), safe=False)

