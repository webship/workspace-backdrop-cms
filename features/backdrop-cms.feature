Feature: The Backdrop CMS plugin on the dashboard
  Once the plugin is activated and installed, the sites folders offer the Backdrop CMS builder, the
  AI Agents folder lists the Backdrop CMS agents, and the Plugins page lists the plugin with its steps.

  Scenario: The plugin is listed on the Plugins page
    Given I am on "/settings/plugins"
     Then I should see "Backdrop CMS"
      And I should see "@webship.co/workspace-backdrop-cms"

  Scenario: A sites folder offers the Backdrop CMS builder
    Given I am on "/dev"
     Then "option[value='cmd-backdrop-cms-project.sh']" should be attached

  Scenario: The AI Agents folder lists the agents the plugin ships
    Given I am on "/ai-agents"
     Then I should see "backdrop-cms-site-builder"
      And I should see "backdrop-cms-tester"
