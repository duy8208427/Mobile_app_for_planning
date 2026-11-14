import { StyleProp, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

type Props = { html: string; style?: StyleProp<ViewStyle> };

// Native (Android/iOS): render the self-contained MapLibre page in a WebView.
// The web build uses MapHtmlView.web.tsx, since react-native-webview has no web support.
export default function MapHtmlView({ html, style }: Props) {
  return <WebView originWhitelist={["*"]} source={{ html }} style={[{ flex: 1 }, style]} />;
}
