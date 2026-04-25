package app.lerna.mobile;

import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LernaSpeechPlugin.class);
        super.onCreate(savedInstanceState);
        applyOrientationPolicy();
    }

    @Override
    public void onResume() {
        super.onResume();
        applyOrientationPolicy();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyOrientationPolicy();
    }

    private void applyOrientationPolicy() {
        setRequestedOrientation(
            isTablet()
                ? ActivityInfo.SCREEN_ORIENTATION_FULL_USER
                : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        );
    }

    private boolean isTablet() {
        Configuration configuration = getResources().getConfiguration();
        return configuration.smallestScreenWidthDp >= 600;
    }
}
