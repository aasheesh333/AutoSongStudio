using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;

public class GridSlot : MonoBehaviour
{
    public int Index;
    public MergeItem currentItem;
}

public class GridManager : MonoBehaviour
{
    public static GridManager Instance { get; private set; }

    public int Rows = 7;
    public int Cols = 5;
    public float CellSize = 150f;
    public float Spacing = 20f;

    private List<GridSlot> slots = new List<GridSlot>();
    private Transform gridContainer;

    private void Awake()
    {
        Instance = this;
    }

    public void InitializeGrid(Transform container)
    {
        gridContainer = container;

        // Clean existing
        foreach(Transform child in container) Destroy(child.gameObject);
        slots.Clear();

        // Create Grid Layout
        GridLayoutGroup gridLayout = container.gameObject.AddComponent<GridLayoutGroup>();
        gridLayout.cellSize = new Vector2(CellSize, CellSize);
        gridLayout.spacing = new Vector2(Spacing, Spacing);
        gridLayout.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
        gridLayout.constraintCount = Cols;
        gridLayout.childAlignment = TextAnchor.MiddleCenter;

        // Create Slots
        for (int i = 0; i < Rows * Cols; i++)
        {
            GameObject slotObj = new GameObject($"Slot_{i}");
            slotObj.transform.SetParent(container, false);

            Image slotBg = slotObj.AddComponent<Image>();
            slotBg.color = new Color(0.9f, 0.9f, 0.9f, 0.5f); // Light gray placeholder

            GridSlot slot = slotObj.AddComponent<GridSlot>();
            slot.Index = i;
            slots.Add(slot);
        }

        // Load Items
        RestoreGrid(GameManager.Instance.GetGameState().gridItems);
    }

    public void SpawnItem(int level)
    {
        // Find empty slot
        GridSlot emptySlot = slots.Find(s => s.currentItem == null);
        if (emptySlot != null)
        {
            CreateItemObject(level, emptySlot);
            SaveGridState();
        }
        else
        {
            Debug.Log("Grid Full!");
        }
    }

    private void CreateItemObject(int level, GridSlot slot)
    {
        GameObject itemObj = new GameObject($"Item_{level}");
        itemObj.transform.SetParent(slot.transform, false);

        MergeItem item = itemObj.AddComponent<MergeItem>();
        item.Initialize(level, slot.Index);

        slot.currentItem = item;
    }

    public void MergeItems(MergeItem source, MergeItem target)
    {
        // Source is dragged onto Target
        int newLevel = target.Level + 1;
        int targetIndex = target.GridIndex;

        // Destroy source object
        GridSlot sourceSlot = slots[source.GridIndex];
        sourceSlot.currentItem = null;
        Destroy(source.gameObject);

        // Update target object
        target.Upgrade();

        SaveGridState();
    }

    public void MoveItem(MergeItem item, int newSlotIndex)
    {
        GridSlot oldSlot = slots[item.GridIndex];
        GridSlot newSlot = slots[newSlotIndex];

        oldSlot.currentItem = null;
        newSlot.currentItem = item;

        item.transform.SetParent(newSlot.transform, false);
        item.Initialize(item.Level, newSlotIndex); // Update internal index reference
        // Ensure it's centered
        item.GetComponent<RectTransform>().anchoredPosition = Vector2.zero;

        SaveGridState();
    }

    private void RestoreGrid(List<MergeItemData> data)
    {
        if (data == null) return;

        foreach(var itemData in data)
        {
            if (itemData.gridIndex < slots.Count)
            {
                CreateItemObject(itemData.level, slots[itemData.gridIndex]);
            }
        }
    }

    private void SaveGridState()
    {
        List<MergeItemData> items = new List<MergeItemData>();
        foreach(var slot in slots)
        {
            if (slot.currentItem != null)
            {
                MergeItemData data = new MergeItemData();
                data.gridIndex = slot.Index;
                data.level = slot.currentItem.Level;
                items.Add(data);
            }
        }
        GameManager.Instance.UpdateGridState(items);
    }
}
