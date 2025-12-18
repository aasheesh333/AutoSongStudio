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

        var scene = UnityEditor.SceneManagement.EditorSceneManager.NewScene(UnityEditor.SceneManagement.NewSceneSetup.DefaultGameObjects, UnityEditor.SceneManagement.NewSceneMode.Single);

        GameObject root = new GameObject("GameRoot");
        root.AddComponent<Bootstrapper>();

        UnityEditor.SceneManagement.EditorSceneManager.SaveScene(scene, scenePath);

        string[] scenes = new string[] { scenePath };

        // 2. Configure Player Settings (Signed)
        PlayerSettings.Android.keystoreName = "user.keystore";
        PlayerSettings.Android.keystorePass = "password";
        PlayerSettings.Android.keyaliasName = "mergeidle";
        PlayerSettings.Android.keyaliasPass = "password";

        EditorUserBuildSettings.buildAppBundle = false; // Start with APK

        // 3. Build Debug APK
        BuildPlayerOptions buildOptions = new BuildPlayerOptions();
        buildOptions.scenes = scenes;
        buildOptions.locationPathName = "Builds/MergeIdleEmpire-debug.apk";
        buildOptions.target = BuildTarget.Android;
        buildOptions.options = BuildOptions.Development;

        Debug.Log("Building Debug APK...");
        BuildPipeline.BuildPlayer(buildOptions);

        // 4. Build Release APK (Signed)
        buildOptions.locationPathName = "Builds/MergeIdleEmpire-release.apk";
        buildOptions.options = BuildOptions.None; // Release

        Debug.Log("Building Release APK...");
        BuildPipeline.BuildPlayer(buildOptions);

        // 5. Build Release AAB (Signed)
        EditorUserBuildSettings.buildAppBundle = true;
        buildOptions.locationPathName = "Builds/MergeIdleEmpire-release.aab";

        Debug.Log("Building Release AAB...");
        BuildPipeline.BuildPlayer(buildOptions);
    }
}
