using UnityEngine;
using UnityEngine.UI;

public class GameUI : MonoBehaviour
{
    private Text coinsText;
    private Transform gridContainer;
    private Transform canvasTr;

    private void Start()
    {
        BuildUI();
        GameManager.Instance.OnCoinsChanged += UpdateCoinsUI;
        UpdateCoinsUI(GameManager.Instance.Coins);
    }

    private void BuildUI()
    {
        GameObject canvasObj = UIManager.CreateCanvas("MainCanvas");
        canvasTr = canvasObj.transform;

        // Background
        UIManager.CreatePanel(canvasTr, "Background", new Color(0.95f, 0.95f, 1.0f));

        // Top HUD
        GameObject topBar = new GameObject("TopHUD");
        topBar.transform.SetParent(canvasTr, false);
        RectTransform topRt = topBar.AddComponent<RectTransform>();
        topRt.anchorMin = new Vector2(0, 0.9f);
        topRt.anchorMax = new Vector2(1, 1);
        topRt.offsetMin = Vector2.zero;
        topRt.offsetMax = Vector2.zero;

        coinsText = UIManager.CreateText(topBar.transform, "Coins: 0", 40);
        coinsText.rectTransform.anchorMin = Vector2.zero;
        coinsText.rectTransform.anchorMax = Vector2.one;

        // Grid Area
        GameObject gridArea = new GameObject("GridArea");
        gridArea.transform.SetParent(canvasTr, false);
        RectTransform gridRt = gridArea.AddComponent<RectTransform>();
        gridRt.anchorMin = new Vector2(0.05f, 0.15f);
        gridRt.anchorMax = new Vector2(0.95f, 0.85f);
        gridRt.offsetMin = Vector2.zero;
        gridRt.offsetMax = Vector2.zero;

        // Let GridManager know where to build
        GridManager.Instance.InitializeGrid(gridArea.transform);

        // Bottom Bar
        GameObject bottomBar = new GameObject("BottomBar");
        bottomBar.transform.SetParent(canvasTr, false);
        RectTransform botRt = bottomBar.AddComponent<RectTransform>();
        botRt.anchorMin = new Vector2(0, 0);
        botRt.anchorMax = new Vector2(1, 0.12f);
        botRt.offsetMin = Vector2.zero;
        botRt.offsetMax = Vector2.zero;

        Image botImg = bottomBar.AddComponent<Image>();
        botImg.color = new Color(0.2f, 0.2f, 0.2f);

        // Layout for bottom bar
        HorizontalLayoutGroup hlg = bottomBar.AddComponent<HorizontalLayoutGroup>();
        hlg.childAlignment = TextAnchor.MiddleCenter;
        hlg.spacing = 20;

        // Shop Button
        UIManager.CreateButton(bottomBar.transform, "Shop", () => ShowShop());

        // Spawn Button (Buy Box)
        Button spawnBtn = UIManager.CreateButton(bottomBar.transform, "Buy Box (10)", () => {
            if (GameManager.Instance.SpendCoins(10))
            {
                GridManager.Instance.SpawnItem(1);
            }
            else
            {
                 // Allow charity spawn if broke
                if (GameManager.Instance.Coins < 10) GridManager.Instance.SpawnItem(1);
            }
        });

        // Upgrades Button (New)
        UIManager.CreateButton(bottomBar.transform, "Upgrades", () => ShowUpgrades());

        // Settings Button
        UIManager.CreateButton(bottomBar.transform, "Settings", () => ShowSettings());
    }

    private void UpdateCoinsUI(double coins)
    {
        if (coinsText != null)
            coinsText.text = $"Coins: {coins:F0}";
    }

    private void ShowShop()
    {
        UIManager.CreatePopup(canvasTr, "Shop", "Boosts:\n- Speed x2\n- Income x2\n\nIAP Placeholders:\n- No Ads\n- Starter Pack");
    }

    private void ShowUpgrades()
    {
        UIManager.CreatePopup(canvasTr, "Factory Upgrades", "Global Upgrades:\n\n[Production Speed] (Cost: 500)\n\n[Income Multiplier] (Cost: 1000)\n\n(Placeholders - Logic to be connected)");
    }

    private void ShowSettings()
    {
        UIManager.CreatePopup(canvasTr, "Settings", "Sound: ON\nMusic: ON\n\nRestore Purchases\nPrivacy Policy");
    }
}
