using UnityEngine;
using System.Collections.Generic;

[System.Serializable]
public class GameState
{
    public double coins;
    public double incomeMultiplier = 1.0;
    public string lastLoginTime;
    public List<MergeItemData> gridItems = new List<MergeItemData>();
}

[System.Serializable]
public class MergeItemData
{
    public int gridIndex;
    public int level;
}

public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    public double Coins { get; private set; }
    public double IncomeMultiplier { get; private set; } = 1.0;

    private const string SAVE_KEY = "MergeIdleEmpire_Save";
    private GameState currentState;

    public event System.Action<double> OnCoinsChanged;

    private void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
            LoadGame();
        }
        else
        {
            Destroy(gameObject);
        }
    }

    private void Start()
    {
        // Calculate offline earnings
        CalculateOfflineEarnings();
        // Start auto-save loop
        InvokeRepeating(nameof(SaveGame), 5f, 30f);
    }

    public void AddCoins(double amount)
    {
        Coins += amount;
        OnCoinsChanged?.Invoke(Coins);
    }

    public bool SpendCoins(double amount)
    {
        if (Coins >= amount)
        {
            Coins -= amount;
            OnCoinsChanged?.Invoke(Coins);
            SaveGame();
            return true;
        }
        return false;
    }

    public void UpdateGridState(List<MergeItemData> items)
    {
        currentState.gridItems = items;
        // Save triggered by grid change is optional, usually handled by periodic save or critical events
    }

    private void SaveGame()
    {
        currentState.coins = Coins;
        currentState.incomeMultiplier = IncomeMultiplier;
        currentState.lastLoginTime = System.DateTime.UtcNow.ToString();
        // Grid state should be updated by GridManager before saving, or we fetch it here if we had a direct ref
        // For loose coupling, GridManager should update GameManager's state data whenever it changes.

        string json = JsonUtility.ToJson(currentState);
        PlayerPrefs.SetString(SAVE_KEY, json);
        PlayerPrefs.Save();
    }

    private void LoadGame()
    {
        if (PlayerPrefs.HasKey(SAVE_KEY))
        {
            string json = PlayerPrefs.GetString(SAVE_KEY);
            currentState = JsonUtility.FromJson<GameState>(json);
            Coins = currentState.coins;
            IncomeMultiplier = currentState.incomeMultiplier;
        }
        else
        {
            currentState = new GameState();
            Coins = 0; // Starting coins could be 100 or something
            currentState.lastLoginTime = System.DateTime.UtcNow.ToString();
        }
    }

    private void CalculateOfflineEarnings()
    {
        if (string.IsNullOrEmpty(currentState.lastLoginTime)) return;

        System.DateTime lastLogin = System.DateTime.Parse(currentState.lastLoginTime);
        System.TimeSpan diff = System.DateTime.UtcNow - lastLogin;
        double secondsPassed = diff.TotalSeconds;

        if (secondsPassed > 60) // Only calc if away for more than a minute
        {
            // We need to know the total income per second of the grid.
            // Since GameManager doesn't hold live references to items yet,
            // we calculate based on the saved grid data.
            double totalIncomePerSecond = 0;
            foreach(var item in currentState.gridItems)
            {
                 totalIncomePerSecond += GetIncomeForLevel(item.level);
            }

            double offlineEarnings = totalIncomePerSecond * secondsPassed * 0.5; // 50% efficiency offline
            if (offlineEarnings > 0)
            {
                AddCoins(offlineEarnings);
                Debug.Log($"Offline Earnings: {offlineEarnings}");
                // TODO: Show Offline Earnings Popup
            }
        }
    }

    public GameState GetGameState()
    {
        return currentState;
    }

    // Shared logic for economy
    public static double GetIncomeForLevel(int level)
    {
        // Base income = 1, multiplies by 1.5 per level approx
        return System.Math.Pow(1.5, level - 1);
    }

    public static double GetUpgradeCost(int level)
    {
        // Cost to buy a level 1 factory from shop
        // Actually, usually we buy level 1s.
        // Or we buy specific levels.
        return 10 * System.Math.Pow(2.2, level - 1);
    }
}
