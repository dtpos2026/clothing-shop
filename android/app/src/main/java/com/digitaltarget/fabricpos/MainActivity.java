package com.digitaltarget.fabricpos;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DtNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
