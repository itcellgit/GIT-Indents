<?php
//session_start();
//session_destroy();
//session_start();

date_default_timezone_set("Asia/Kolkata");
require_once("includes/pdofunctions_v1.php");
require_once("includes/functions.php");
$userErr = "";
define('BASEPATH', 'UsedIndexPage');
$_SESSION['UserName']  = "";
$_SESSION['UserType'] =  "";
$_SESSION['mainpath'] = getcwd();

//var_dump($_POST);
if (isset($_POST['login'])) {

  $db = ConnectPDO();
  if (!$db) {
    MsgBox("Could not Connect Database", "", true);
    exit();
  }

  $Password    = filter_input(INPUT_POST, 'password', FILTER_UNSAFE_RAW);
  $PasswordMD5 = MD5($Password);
  $UserName    = filter_input(INPUT_POST, 'username', FILTER_UNSAFE_RAW);

  // Parameterized query: user-supplied values are bound, never concatenated into the SQL string.
  $stmt = $db->prepare("Select * from users Where Password = :password AND LoginID = :username and Status = 'Active'");
  $stmt->execute([':password' => $PasswordMD5, ':username' => $UserName]);
  $UserRow = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($UserRow) {
    session_start();
    $_SESSION['VALIDUSER'] = "Yes";
    $_SESSION['UserRow']  = $UserRow;
    $_SESSION['UserName']  = $UserRow['Name'];
    $_SESSION['UserType'] =  $UserRow['UserType'];
    $_SESSION['UserID']   = $UserRow['UserID'];
    $_SESSION['MemberID'] = "";
    $_SESSION['mainpath'] = getcwd();

      header("location: accounts/accountsmenu.php");
    //exit();
  } else {
    $stmt = $db->prepare("Select * from shareholders Where (DOB = :password OR Password = :passwordmd5) AND MemberID = :username");
    $stmt->execute([':password' => $Password, ':passwordmd5' => $PasswordMD5, ':username' => $UserName]);
    $MemberRow = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($MemberRow) {
      session_start();
      define('VALIDUSER', 'Yes');
      $_SESSION['UserRow']  = $MemberRow;
      $_SESSION['UserName']  = $MemberRow['Name'];
      $_SESSION['UserType'] =  "Member";
      $_SESSION['UserID'] =  0;
      $_SESSION['MemberID'] = $MemberRow['MemberID'];
      $_SESSION['mainpath'] = getcwd();
      //MsgBox('', '', false);
      header("location: members/membershome.php");


    }
    else {
      session_unset();
      session_destroy();
      //session_start();
      //$_SESSION['UserName'] = "Invalid";
      //$_SESSION['UserType'] = "";

      MsgBox('Error!!! Invalid Member Credentials', 'login.php', true);
    }
  }
  MsgBox($_SESSION['UserName'], '', false);
  /*if ($_SESSION['UserType'] == "Member") {
    header("location: members/membershome.php");

      exit();
    
  }
  if (strstr("Admin,Chairman,Accounts,Shares,Loans", $_SESSION['UserType'])) {
   header("location: accounts/accountsmenu.php");
    exit();
  }*/
} else {
  
   // echo 'fields not filled';
}
?>

<?php //include_once 'navbar.php' 
    
    //includes the html tag with head section of the web page. (Starts with Body Tag)
    include_once 'includes/Layout/header.php';
    
    //includes the navbar consisting of Nav menus for home page.
    include_once 'includes/Layout/navbar.php';
    ?>
    
<div class=" hold-transition login-page">
  <section class="content">
  <div class="login-box" style="height:28em;">
  <div class="login-logo">
    <!--a href="index.php"><b>GIT </b>Employees Cooperative Credit Society Limited</a-->
  </div>
  <!-- /.login-logo -->
  <div class="login-box-body">
    <p class="login-box-msg">Sign in to start your session</p>

    <form action="#" method="post">
      <div class="form-group has-feedback">
      <input type="text" name="username" placeholder="Your Username" class="form-control"/>
        <span class="glyphicon glyphicon-envelope form-control-feedback"></span>
      </div>
      <div class="form-group has-feedback">
      <input type="password" name="password" placeholder="Your Password" class="form-control"/>
        <span class="glyphicon glyphicon-lock form-control-feedback"></span>
      </div>
      <div class="row">
        <!--div class="col-xs-8">
          <div class="checkbox icheck">
            <label>
              <input type="checkbox"> Remember Me
            </label>
          </div>
        </div-->
        <!-- /.col -->
        <div class="col-xs-4 pull-right">
        <input type="submit" class="btn btn-primary  btn-block btn-flat" id="login" value="Sign In" name="login"/ >
        
        </div>
        <!-- /.col -->
      </div>
    </form>

    <a href="#">I forgot my password</a><br>
    <!--a href="register.html" class="text-center">Register a new membership</a-->

  </div>
  <!-- /.login-box-body -->
  <div class="clearfix"></div>
</div>
</div>
<!-- /.login-box -->
</section>
</div>     
  <?php
      //includes the footer section with closure of body tag, the javascript and the html tag
    include_once 'includes/Layout/footer.php';
    ?>