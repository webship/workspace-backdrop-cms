Feature: A term and a menu link are added and removed again
  As the owner of the site
  I want a term added to the tags and a link added to the primary navigation, and both deleted
  So that the suite proves the forms work and leaves the site as it found it

  Scenario: The editor adds a term to the tags and deletes it
    Given I am logged in as "editor"
    And the term "A term written by a scenario" does not exist in the "Tags" vocabulary
    When I add the term "A term written by a scenario" to the "Tags" vocabulary
    Then the status message should contain "Created new term A term written by a scenario."
    And the "Tags" vocabulary should have the term "A term written by a scenario"
    When I delete the term "A term written by a scenario" from the "Tags" vocabulary
    Then the "Tags" vocabulary should not have the term "A term written by a scenario"

  Scenario: The administrator adds a link to the primary navigation and deletes it
    Given I am logged in as "admin"
    And the link "A link written by a scenario" does not exist in the "Primary navigation" menu
    When I add the link "A link written by a scenario" to "<front>" in the "Primary navigation" menu
    Then the "Primary navigation" menu should have the link "A link written by a scenario"
    When I go to the homepage
    Then the primary navigation should list "A link written by a scenario"
    When I delete the link "A link written by a scenario" from the "Primary navigation" menu
    Then the "Primary navigation" menu should not have the link "A link written by a scenario"
    When I go to the homepage
    Then the primary navigation should not list "A link written by a scenario"

  Scenario: The primary navigation has the links of a fresh site
    Given I am an anonymous user
    And I am on the homepage
    Then the primary navigation should list "Home"
    And the primary navigation should list "About"
    When I click "About" in the primary navigation
    Then the page heading should be "About"
