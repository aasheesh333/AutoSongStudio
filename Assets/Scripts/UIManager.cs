using UnityEngine;
using UnityEngine.UI;

public static class UIManager
{
    public static GameObject CreateCanvas(string name)
    {
        GameObject go = new GameObject(name);
        Canvas c = go.AddComponent<Canvas>();
        c.renderMode = RenderMode.ScreenSpaceOverlay;

        // Better Scaling for Mobile
        CanvasScaler scaler = go.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080, 1920); // Portrait HD
        scaler.matchWidthOrHeight = 0.5f; // Balance between width and height

        go.AddComponent<GraphicRaycaster>();
        return go;
    }

    public static RectTransform CreatePanel(Transform parent, string name, Color color)
    {
        GameObject go = new GameObject(name);
        go.transform.SetParent(parent, false);
        RectTransform rt = go.AddComponent<RectTransform>();
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero; // Full stretch

        Image img = go.AddComponent<Image>();
        img.color = color;

        return rt;
    }

    public static Text CreateText(Transform parent, string content, int fontSize)
    {
        GameObject go = new GameObject("Text");
        go.transform.SetParent(parent, false);
        Text txt = go.AddComponent<Text>();
        txt.text = content;

        // Font Strategy: Dynamic Font (Best for code-only)
        // Try common fonts: Arial (PC), Roboto (Android), Helvetica (iOS)
        Font font = Font.CreateDynamicFontFromOSFont("Arial", fontSize);

        // If that fails (font texture null or logic), try others
        if (font == null) font = Font.CreateDynamicFontFromOSFont("Roboto", fontSize);
        if (font == null) font = Font.CreateDynamicFontFromOSFont("Helvetica", fontSize);

        // As a last resort, we don't set it (Unity might render nothing or default)
        // But CreateDynamicFontFromOSFont usually returns a Font object even if it falls back.
        txt.font = font;

        txt.fontSize = fontSize;
        txt.color = Color.black;
        txt.alignment = TextAnchor.MiddleCenter;

        // Default size
        RectTransform rt = go.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(200, 50);

        return txt;
    }

    public static Button CreateButton(Transform parent, string label, System.Action onClick)
    {
        GameObject go = new GameObject("Button_" + label);
        go.transform.SetParent(parent, false);

        Image img = go.AddComponent<Image>();
        img.color = Color.white;

        Button btn = go.AddComponent<Button>();
        btn.onClick.AddListener(() => onClick());

        // Label
        Text txt = CreateText(go.transform, label, 20);
        RectTransform txtRt = txt.GetComponent<RectTransform>();
        txtRt.anchorMin = Vector2.zero;
        txtRt.anchorMax = Vector2.one;
        txtRt.offsetMin = Vector2.zero;
        txtRt.offsetMax = Vector2.zero;

        RectTransform rt = go.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(100, 50);

        return btn;
    }

    public static GameObject CreatePopup(Transform parent, string title, string bodyText)
    {
        // Panel Background (Dim)
        GameObject popupObj = new GameObject("Popup_" + title);
        popupObj.transform.SetParent(parent, false);
        RectTransform rt = popupObj.AddComponent<RectTransform>();
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;

        Image bg = popupObj.AddComponent<Image>();
        bg.color = new Color(0, 0, 0, 0.8f);

        // Content Box
        GameObject content = new GameObject("Content");
        content.transform.SetParent(popupObj.transform, false);
        RectTransform contentRt = content.AddComponent<RectTransform>();
        contentRt.sizeDelta = new Vector2(800, 1000);
        Image contentImg = content.AddComponent<Image>();
        contentImg.color = Color.white;

        // Title
        Text titleTxt = CreateText(content.transform, title, 60);
        titleTxt.rectTransform.anchoredPosition = new Vector2(0, 400);

        // Body
        Text bodyTxt = CreateText(content.transform, bodyText, 40);
        bodyTxt.rectTransform.anchoredPosition = new Vector2(0, 100);

        // Close Button
        Button closeBtn = CreateButton(content.transform, "Close", () => {
            GameObject.Destroy(popupObj);
        });
        closeBtn.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, -400);
        closeBtn.GetComponent<RectTransform>().sizeDelta = new Vector2(300, 100);

        return popupObj;
    }
}
