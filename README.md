# DeepTrace: URL Finder for JavaScript Files and Webpages
[![Firefox Add-on](https://img.shields.io/amo/v/deeptrace)](https://addons.mozilla.org/en-US/firefox/addon/deeptrace/) ![Firefox Add-on Users](https://img.shields.io/amo/users/deeptrace)
![GitHub License](https://img.shields.io/github/license/georgedevasia0/EndPointer)


![alt text](public/icons/DeepTrace-banner.png)

### What is DeepTrace?
DeepTrace is a browser extension designed for ethical hackers and web developers to discover potentially vulnerable endpoints on the current webpage and its linked JavaScript files. It offers customizable features that allow users to control the scan settings, making it adaptable for various use cases. One standout feature is its ability to capture dynamically loaded JavaScript files, ensuring even asynchronously loaded scripts are analyzed. With DeepTrace, users can efficiently identify exposed endpoints and improve the security posture of web applications. This extension was made using our custom extension template in react with many features.

Key Features:

- <b>URL/Endpoint parsing:</b> Parse for URLs in the current webpage and externally linked javascript files
- <b>Dynamic Script Loading:</b> Parses and checks for dynamically loaded script tags upon initial load
- <b>Auto parsing:</b> Parses automatically when the document is loaded
- <b>Manual parsing:</b> Parses when the "REPARSE" button is clicked
- ...

<br>
<p align="center"><a href="#Download"><img src="public/icons/DeepTrace.png"></a></p>

<br>
<br>
<div align="center">
</div>
<br>

<a name="Download"></a>
<h2><img src="https://github.com/user-attachments/assets/466328bf-6dce-4cf3-bb53-ce427e8d7f25" width="30"> Download & Installation</h2>

You have several options to download the extension. You can install it directly from Firefox, from the Firefox Add-ons site. Alternatively, you can download the extension from GitHub, giving you access to the source code. For those who want to load it up locally: be sure to run `npm i && npm run build` to download all packages and to create the dist/ file. Then, load the dist/ file as unpacked in Firefox.

<div align="left">
<a href="https://addons.mozilla.org/en-US/firefox/addon/deeptrace/"><img src="https://github.com/user-attachments/assets/7585ac45-b59d-4d9e-a4a3-ddfd2d59b533" alt="image (2)" width="170"/></a>
</div>

<br>

<a name="Functionalities"></a>
<h2><img src="https://github.com/user-attachments/assets/499bb537-9478-4341-8d55-773069796de8" width="30"> Key Features & Functionalities</h2>

DeepTrace offers a wide range of capabilities aimed at simplifying the process of finding and analyzing endpoints across webpages and JavaScript files. Designed with flexibility and ease of use in mind, this tool allows users to control parsing behavior, interact with results, and dynamically capture changes in web content. Whether you need real-time updates or manual control, DeepTrace provides the tools necessary to streamline the process of endpoint discovery and security analysis.

Key Features:

| Key Feature | Description |
| ----------- | ----------- |
| **URL/Endpoint Parsing:** | Extracts URLs from the current webpage and externally linked JavaScript files.|
| **Dynamic Script Loading:** | Automatically parses dynamically loaded script tags upon initial load. |
| **Auto Parsing:** | Automatically triggers parsing when the document is fully loaded. |
| **Manual Parsing:** | Provides the option to manually trigger parsing using the "REPARSE" button. |
| **Scope Declaration:** | Allows users to define parsing scope based on the second-level domain (SLD) and top-level domain (TLD), or individual subdomains. |
| **Concurrent Request Setting:** | Configures the number of concurrent requests to optimize performance during scans. |
| **Interactive UI:** | Offers multiple interface options, including DevTools, popups, and web page interactions. |
| **Interactivity with URLs:** | Search, filter, view code snippets, and inspect responses for each URL. |
| **Output Results:** | Provides different viewing formats, such as Default View and Tree View, for better clarity. |
| **Output Saving:** | Export results in TXT, CSV, or raw unmodified formats for further analysis. |
| **Dynamic Loading/Live Updating:** | URL results and counts are updated in real-time without requiring page refreshes. |
| **CSP friendly:** | Compatible with web apps with strict CSP policies. |
| **Browser States:** | Can parse URLs in an authenticated state or states relying the use of local storage and indexeddb. |

<br>

<a name="Development"></a>
<h2><img src="https://github.com/user-attachments/assets/6f0ac000-6590-47e4-83ea-776fb27ca1fb" width="30"> Developments & Fixes</h2>

We are committed to consistently improving this tool with regular updates and welcome contributions from the community to enhance its functionality. That’s why we’ve made it open source, enabling individuals to contribute their improvements. Here are some of the latest developments and fixes:

Developments:
  - [ ] Development 1
  - [ ] Development 2
  - [ ] Development 3

Fixes:
  - [ ] Fixe 1
  - [ ] Fixe 2
  - [ ] Fixe 3

<br>

<br>

How to contribute: 
1. Clone the repo
2. Create a branch called Contribution/{feature name}
3. Send a pull request to this repo with your changes from Contribution/{feature name}

<br>

## Disclaimer
The tool provided on this GitHub page is intended for educational and research purposes only. The creators and maintainers of this tool are not responsible for any misuse or illegal use of the tool. It is the responsibility of the users to ensure that they comply with all applicable laws and regulations while using the tool.
