Feature: The site answers and its accounts work
  As the owner of the site
  I want the front page, the log in form and each default account to work
  So that a build that came out broken is caught before anything else is tested

  # Placed by the workspace's testing setup as a starting point: it is yours to change.
  # The accounts are the default ones (cmd-tools-add-users.sh); a scenario logs in by a handle of
  # the users registry in cucumber.js, so no password is written here.

  @critical
  Scenario: The front page is served
    Given I am an anonymous user
    And I am on the homepage
    Then the response status code should be 200
    And the page should have a title

  @critical
  Scenario: The log in form is served
    Given I am an anonymous user
    When I go to "/user/login"
    Then the response status code should be 200
    And I should see "Username"
    And I should see "Password"

  Scenario Outline: Each default account logs in
    Given I am logged in as "<handle>"
    Then I should be logged in as "<handle>"

    Examples:
      | handle |
      | admin  |
      | editor |
      | member |

  Scenario: Each default account has the role it was given
    Given I am logged in as "admin"
    Then the account "administrator" should have the "Administrator" role
    And the account "editor" should have the "Editor" role
    And the account "editor" should not have the "Administrator" role
    And the account "member" should not have the "Editor" role
    And the account "member" should be active

  Scenario: An account is refused a page its role may not open
    Given I am logged in as "editor"
    Then I should have access to "admin/content"
    But I should not have access to "admin/structure/layouts"

  Scenario: A visitor is denied the administration
    Given I am an anonymous user
    When I go to "/admin/content"
    Then the page should be an access denied page

  Scenario: A visitor has no session
    Given I am an anonymous user
    Then I should be logged out
