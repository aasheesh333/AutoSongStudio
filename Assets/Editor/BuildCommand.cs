using UnityEditor;
using UnityEngine;
using System.IO;

public class BuildCommand
{
    public static void PerformBuild()
    {
        // 1. Setup Scene
        string scenePath = "Assets/Scenes/Main.unity";
        Directory.CreateDirectory("Assets/Scenes");

        // We create a dummy scene because Bootstrapper runs via [RuntimeInitializeOnLoadMethod]
        // but we need at least one scene in the build.
        var scene = UnityEditor.SceneManagement.EditorSceneManager.NewScene(UnityEditor.SceneManagement.NewSceneSetup.DefaultGameObjects, UnityEditor.SceneManagement.NewSceneMode.Single);

        // Add a GameObject to hold the Bootstrapper script explicitly if we wanted,
        // but the static method works globally.
        // However, standard practice: let's add an empty GO "GameRoot" just in case.
        GameObject root = new GameObject("GameRoot");
        root.AddComponent<Bootstrapper>(); // This ensures it runs even if static init is finicky on Android

        UnityEditor.SceneManagement.EditorSceneManager.SaveScene(scene, scenePath);

        string[] scenes = new string[] { scenePath };

        // 2. Configure Player Settings
        PlayerSettings.Android.keystoreName = "";
        PlayerSettings.Android.keystorePass = "";
        PlayerSettings.Android.keyaliasName = "";
        PlayerSettings.Android.keyaliasPass = "";

        // Basic Signing for Debug (Unity handles debug.keystore automatically if fields are empty)
        EditorUserBuildSettings.buildAppBundle = false; // Start with APK

        // 3. Build Debug APK
        BuildPlayerOptions buildOptions = new BuildPlayerOptions();
        buildOptions.scenes = scenes;
        buildOptions.locationPathName = "Builds/MergeIdleEmpire-debug.apk";
        buildOptions.target = BuildTarget.Android;
        buildOptions.options = BuildOptions.Development;

        Debug.Log("Building Debug APK...");
        BuildPipeline.BuildPlayer(buildOptions);

        // 4. Build Release APK
        buildOptions.locationPathName = "Builds/MergeIdleEmpire-release.apk";
        buildOptions.options = BuildOptions.None; // Release

        Debug.Log("Building Release APK...");
        BuildPipeline.BuildPlayer(buildOptions);

        // 5. Build Release AAB
        EditorUserBuildSettings.buildAppBundle = true;
        buildOptions.locationPathName = "Builds/MergeIdleEmpire-release.aab";

        Debug.Log("Building Release AAB...");
        BuildPipeline.BuildPlayer(buildOptions);
    }
}
