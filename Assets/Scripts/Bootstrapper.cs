using UnityEngine;
using UnityEngine.EventSystems;

public class Bootstrapper : MonoBehaviour
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Init()
    {
        // Only run if there is no GameManager (prevents duplicates if reloading)
        if (GameManager.Instance != null) return;

        GameObject app = new GameObject("App");
        DontDestroyOnLoad(app);

        // Core Systems
        app.AddComponent<GameManager>();
        app.AddComponent<GridManager>();

        // Input System (Critical for UI & Drag)
        GameObject eventSystem = new GameObject("EventSystem");
        DontDestroyOnLoad(eventSystem);
        eventSystem.AddComponent<EventSystem>();
        eventSystem.AddComponent<StandaloneInputModule>();

        // UI
        app.AddComponent<GameUI>();
    }
}
