Feature: Each account reaches the pages its role may use
  As the owner of the site
  I want every default account to open its own pages and to be refused the others
  So that a change of permissions is caught by the suite

  # The accounts are the default ones; a scenario logs in by a handle of the users registry.

  Scenario: The editor has the content and not the layouts
    Given I am logged in as "editor"
    Then I should be logged in as "editor"
    And I should have access to "admin/content"
    But I should not have access to "admin/structure/layouts"

  Scenario: The administration bar of the editor shows the account and the content
    Given I am logged in as "editor"
    When I go to the "content" administration page
    Then the response status code should be 200
    And I should see the administration bar
    And the administration bar should show the account "editor"
    And the administration bar should list "Content"

  Scenario: A member has no administration
    Given I am logged in as "member"
    Then I should not see the administration bar
    And I should not have access to "admin/content"

  Scenario: A visitor is denied the administration
    Given I am an anonymous user
    When I go to "/admin/content"
    Then the page should be an access denied page
    And I should be logged out

  Scenario: The roles and the accounts are the ones the suite relies on
    Given I am logged in as "admin"
    Then the site should have the role "Editor"
    And the account "editor" should have the "Editor" role
    And the account "member" should not have the "Editor" role
    And the account "member" should be active
    And the status report should not show errors
