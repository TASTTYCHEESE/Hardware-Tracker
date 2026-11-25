package app.hardwaretracker.mobile;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Self-updates the Android app: downloads the new APK from the GitHub release and installs it
 * over the current one with PackageInstaller. Android asks the user once to allow
 * "Install unknown apps" for Hardware Tracker and to confirm the first update. After that, on
 * Android 12 and newer, the app is the installer of its own updates and they install without a prompt.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    static final String ACTION_RESULT = "app.hardwaretracker.mobile.UPDATE_RESULT";
    private volatile boolean busy = false;

    @PluginMethod
    public void status(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject();
        boolean allowed = Build.VERSION.SDK_INT < 26 || ctx.getPackageManager().canRequestPackageInstalls();
        r.put("canInstall", allowed);
        String installer = null;
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                installer = ctx.getPackageManager().getInstallSourceInfo(ctx.getPackageName()).getInstallingPackageName();
            } else {
                installer = ctx.getPackageManager().getInstallerPackageName(ctx.getPackageName());
            }
        } catch (Exception ignored) {
        }
        // Silent updates: Android 12+ and this app installed the current version itself.
        r.put("silent", Build.VERSION.SDK_INT >= 31 && ctx.getPackageName().equals(installer));
        r.put("busy", busy);
        r.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void install(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || !url.startsWith("https://github.com/TASTTYCHEESE/Hardware-Tracker/releases/download/")) {
            call.reject("Bad update URL");
            return;
        }
        if (busy) {
            call.reject("An update is already downloading");
            return;
        }
        busy = true;
        new Thread(() -> {
            try {
                File apk = download(url);
                commit(apk);
                JSObject r = new JSObject();
                r.put("started", true);
                call.resolve(r);
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? e.toString() : e.getMessage());
            } finally {
                busy = false;
            }
        }).start();
    }

    private File download(String address) throws Exception {
        File out = new File(getContext().getCacheDir(), "update.apk");
        URL u = new URL(address);
        HttpURLConnection c = null;
        // GitHub answers with a redirect to its download host; follow up to 5 hops (HTTPS only).
        for (int hop = 0; hop < 5; hop++) {
            c = (HttpURLConnection) u.openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(20000);
            c.setReadTimeout(60000);
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) {
                String loc = c.getHeaderField("Location");
                c.disconnect();
                if (loc == null) throw new Exception("Bad redirect");
                u = new URL(u, loc);
                if (!"https".equals(u.getProtocol())) throw new Exception("Insecure redirect");
                continue;
            }
            if (code != 200) throw new Exception("HTTP " + code);
            break;
        }
        long total = c.getContentLengthLong();
        long done = 0;
        int lastPct = -1;
        try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(out)) {
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) {
                os.write(buf, 0, n);
                done += n;
                if (total > 0) {
                    int pct = (int) (done * 100 / total);
                    if (pct != lastPct) {
                        lastPct = pct;
                        JSObject p = new JSObject();
                        p.put("percent", pct);
                        notifyListeners("progress", p);
                    }
                }
            }
        } finally {
            c.disconnect();
        }
        return out;
    }

    private void commit(File apk) throws Exception {
        Context ctx = getContext();
        PackageInstaller pi = ctx.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(ctx.getPackageName());
        if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        int id = pi.createSession(params);
        try (PackageInstaller.Session s = pi.openSession(id)) {
            try (InputStream in = new FileInputStream(apk); OutputStream os = s.openWrite("update.apk", 0, apk.length())) {
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                s.fsync(os);
            }
            Intent i = new Intent(ctx, UpdateResultReceiver.class).setAction(ACTION_RESULT);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            PendingIntent p = PendingIntent.getBroadcast(ctx, id, i, flags);
            s.commit(p.getIntentSender());
        }
    }
}
