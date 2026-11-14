import { Redirect } from "expo-router";
import { casesHref } from "../../src/cases";

/** Hidden tab kept for old links: staff now work in Hồ sơ vụ việc. */
export default function AdminTabRedirect() {
  return <Redirect href={casesHref()} />;
}
