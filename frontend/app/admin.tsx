import { Redirect } from "expo-router";
import { casesHref } from "../src/cases";

/** Old report center: replaced by the case workflow (Hồ sơ vụ việc). */
export default function AdminRedirect() {
  return <Redirect href={casesHref()} />;
}
