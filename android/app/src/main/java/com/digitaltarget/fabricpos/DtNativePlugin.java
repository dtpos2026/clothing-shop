package com.digitaltarget.fabricpos;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Native helpers used by the web app:
 *  - shareToWhatsApp: opens WhatsApp (or WhatsApp Business) with a file attached; with a phone
 *    number it opens that chat directly, otherwise WhatsApp shows its contact/group picker.
 *    Resolves {opened:true} when WhatsApp was launched – it can NOT know whether the user pressed Send.
 *  - isAppInstalled
 *  - printHtml: Android system printing (PrintManager) – works with any installed print service
 *    (Wi-Fi printers, Mopria, Bluetooth thermal print services such as RawBT).
 */
@CapacitorPlugin(name = "DtNative")
public class DtNativePlugin extends Plugin {

    private static final String[] WA_PACKAGES = {"com.whatsapp", "com.whatsapp.w4b"};
    private WebView printWebView; // must stay referenced until the print job is spooled

    private Uri toContentUri(String uriString) {
        Uri uri = Uri.parse(uriString);
        if ("file".equals(uri.getScheme())) {
            File f = new File(uri.getPath());
            return FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
        }
        return uri;
    }

    private boolean installed(String pkg) {
        try {
            getContext().getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    @PluginMethod
    public void isAppInstalled(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("installed", installed(call.getString("package", "")));
        call.resolve(ret);
    }

    @PluginMethod
    public void shareToWhatsApp(PluginCall call) {
        String uriStr = call.getString("uri");
        String mime = call.getString("mime", "*/*");
        String phone = call.getString("phone");
        String text = call.getString("text");
        boolean preferBusiness = Boolean.TRUE.equals(call.getBoolean("business", false));
        if (uriStr == null) { call.reject("uri is required"); return; }

        Uri content;
        try {
            content = toContentUri(uriStr);
        } catch (Exception e) {
            call.reject("Cannot share this file: " + e.getMessage());
            return;
        }

        String[] order = preferBusiness ? new String[]{WA_PACKAGES[1], WA_PACKAGES[0]} : WA_PACKAGES;
        for (String pkg : order) {
            if (!installed(pkg)) continue;
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mime);
            intent.setPackage(pkg);
            intent.putExtra(Intent.EXTRA_STREAM, content);
            if (text != null) intent.putExtra(Intent.EXTRA_TEXT, text);
            if (phone != null && !phone.isEmpty()) {
                // Pre-selects the chat for that number (supported by current WhatsApp versions)
                intent.putExtra("jid", phone.replaceAll("[^0-9]", "") + "@s.whatsapp.net");
            }
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("opened", true);
                ret.put("package", pkg);
                call.resolve(ret);
                return;
            } catch (ActivityNotFoundException ignored) {
                // try next package
            }
        }
        JSObject ret = new JSObject();
        ret.put("opened", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void printHtml(PluginCall call) {
        final String html = call.getString("html", "");
        final String jobName = call.getString("jobName", "Document");
        final Double widthMm = call.getDouble("widthMm", 210.0);
        getActivity().runOnUiThread(() -> {
            try {
                WebView wv = new WebView(getActivity());
                wv.getSettings().setJavaScriptEnabled(false);
                wv.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                        PrintAttributes.Builder b = new PrintAttributes.Builder();
                        if (widthMm != null && widthMm < 120) {
                            int wMils = (int) Math.round(widthMm / 25.4 * 1000);
                            b.setMediaSize(new PrintAttributes.MediaSize("THERMAL_" + widthMm.intValue(), "Receipt " + widthMm.intValue() + "mm", wMils, 11000));
                            b.setMinMargins(PrintAttributes.Margins.NO_MARGINS);
                        } else {
                            b.setMediaSize(widthMm != null && widthMm < 180 ? PrintAttributes.MediaSize.ISO_A5 : PrintAttributes.MediaSize.ISO_A4);
                        }
                        pm.print(jobName, adapter, b.build());
                        JSObject ret = new JSObject();
                        ret.put("started", true);
                        call.resolve(ret);
                    }
                });
                printWebView = wv;
                wv.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception e) {
                call.reject("Print failed: " + e.getMessage());
            }
        });
    }
}
