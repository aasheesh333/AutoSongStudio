using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

public class MergeItem : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
{
    public int Level { get; private set; }
    public int GridIndex { get; private set; }

    private Image visuals;
    private Text levelText;
    private RectTransform rectTransform;
    private CanvasGroup canvasGroup;
    private Transform originalParent;
    private Vector3 originalPosition;

    private float incomeTimer;

    public void Initialize(int level, int gridIndex)
    {
        Level = level;
        GridIndex = gridIndex;

        // Setup components if not already
        if (rectTransform == null) SetupComponents();

        UpdateVisuals();
    }

    private void SetupComponents()
    {
        rectTransform = gameObject.AddComponent<RectTransform>();
        visuals = gameObject.AddComponent<Image>();
        canvasGroup = gameObject.AddComponent<CanvasGroup>();

        // Add text for level
        GameObject textObj = new GameObject("LevelText");
        textObj.transform.SetParent(transform);
        levelText = textObj.AddComponent<Text>();
        levelText.alignment = TextAnchor.MiddleCenter;
        levelText.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        levelText.color = Color.black;
        levelText.resizeTextForBestFit = true;

        RectTransform textRect = textObj.GetComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = Vector2.zero;
        textRect.offsetMax = Vector2.zero;
    }

    private void UpdateVisuals()
    {
        // Procedural colors based on level
        float h = (Level * 0.1f) % 1.0f;
        visuals.color = Color.HSVToRGB(h, 0.7f, 0.9f);
        levelText.text = Level.ToString();
    }

    private void Update()
    {
        // Generate income
        incomeTimer += Time.deltaTime;
        if (incomeTimer >= 1.0f)
        {
            incomeTimer = 0;
            GenerateIncome();
        }
    }

    private void GenerateIncome()
    {
        double income = GameManager.GetIncomeForLevel(Level) * GameManager.Instance.IncomeMultiplier;
        GameManager.Instance.AddCoins(income);
        // TODO: Spawn floating text or visual cue
    }

    // --- Drag & Drop ---

    public void OnPointerDown(PointerEventData eventData)
    {
        originalParent = transform.parent;
        originalPosition = transform.position;

        // Move to root to draw above everything
        transform.SetParent(originalParent.parent.parent); // Assuming Grid -> Slot -> Item
        canvasGroup.blocksRaycasts = false;
    }

    public void OnDrag(PointerEventData eventData)
    {
        transform.position = eventData.position;
    }

    public void OnPointerUp(PointerEventData eventData)
    {
        canvasGroup.blocksRaycasts = true;

        // Check for drop target
        GameObject result = eventData.pointerCurrentRaycast.gameObject;

        bool mergedOrMoved = false;

        if (result != null)
        {
            MergeItem otherItem = result.GetComponent<MergeItem>();
            GridSlot slot = result.GetComponent<GridSlot>();

            if (otherItem != null && otherItem != this)
            {
                // Attempt Merge
                if (otherItem.Level == this.Level)
                {
                    GridManager.Instance.MergeItems(this, otherItem);
                    mergedOrMoved = true;
                }
            }
            else if (slot != null)
            {
                // Move to empty slot
                if (slot.currentItem == null)
                {
                    GridManager.Instance.MoveItem(this, slot.Index);
                    mergedOrMoved = true;
                }
            }
        }

        if (!mergedOrMoved)
        {
            // Reset
            transform.SetParent(originalParent);
            transform.position = originalParent.position;
            // Ensure local position is zeroed out to center it
            rectTransform.anchoredPosition = Vector2.zero;
        }
    }

    public void Upgrade()
    {
        Level++;
        UpdateVisuals();
        // Play FX
    }
}
